import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiProvider } from '../external-apis/openai.provider';
import { GeminiProvider } from '../external-apis/gemini.provider';
import { SupabaseService } from '../supabase/supabase.service';
import { GenerateDietDto } from '../shared/dto/generate-diet.dto';
import { DietPlan } from '../shared/types/diet.interface';
import { ApiResponse, createSuccessResponse, createErrorResponse } from '../shared/utils/api-response';

@Injectable()
export class DietService {
  private readonly logger = new Logger(DietService.name);

  constructor(
    private configService: ConfigService,
    private openAiProvider: OpenAiProvider,
    private geminiProvider: GeminiProvider,
    private supabaseService: SupabaseService,
  ) {}

  async generateDiet(dto: GenerateDietDto): Promise<ApiResponse<DietPlan>> {
    try {
      this.logger.log(`Generating diet plan for user: ${dto.userId}`);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate diet plan using selected AI provider
      let aiResponse;
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateDietPlan(dto);
      } else {
        aiResponse = await this.openAiProvider.generateDietPlan(dto);
      }

      return await this.processDietPlan(dto, aiResponse);
    } catch (error) {
      this.logger.error('Error generating diet plan:', error);
      return createErrorResponse('Error al generar plan dietético');
    }
  }

  async generatePersonalizedDiet(dto: GenerateDietDto): Promise<ApiResponse<DietPlan>> {
    try {
      this.logger.log(`Generating personalized diet plan for user: ${dto.userId}`);

      // Obtener perfil del usuario desde Supabase
      const userProfile = await this.getUserProfile(dto.userId);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate diet plan using selected AI provider with user profile
      let aiResponse;
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateDietPlan(dto, userProfile);
      } else {
        aiResponse = await this.openAiProvider.generateDietPlan(dto);
      }

      // Calculate total macros from meals
      const totalMacros = this.calculateTotalMacros(aiResponse.meals);

      // Create diet plan object
      const dietPlan: Partial<DietPlan> = {
        userId: dto.userId,
        name: aiResponse.name,
        description: aiResponse.description,
        goal: dto.goal,
        totalCalories: dto.calories,
        targetMacros: totalMacros,
        meals: aiResponse.meals,
        restrictions: dto.restrictions || [],
      };

      // Save to Supabase
      const savedDiet = await this.supabaseService.saveDietPlan(dietPlan);

      this.logger.log(`Diet plan generated successfully for user: ${dto.userId}, ID: ${savedDiet.id}`);

      return createSuccessResponse(savedDiet, 'Diet plan generated successfully');
    } catch (error) {
      this.logger.error('Error generating diet plan:', error);
      return createErrorResponse<DietPlan>(
        error.message,
        'Failed to generate diet plan'
      );
    }
  }

  async getDiet(planId: string): Promise<ApiResponse<DietPlan>> {
    try {
      const dietPlan = await this.supabaseService.getDietPlan(planId);
      
      if (!dietPlan) {
        return createErrorResponse<DietPlan>('Diet plan not found', 'The requested diet plan does not exist');
      }

      return createSuccessResponse(dietPlan);
    } catch (error) {
      this.logger.error('Error fetching diet plan:', error);
      return createErrorResponse<DietPlan>(
        error.message,
        'Failed to fetch diet plan'
      );
    }
  }

  async regenerateDiet(planId: string, modifications: Partial<GenerateDietDto>): Promise<ApiResponse<DietPlan>> {
    try {
      // Get existing diet plan
      const existingPlan = await this.supabaseService.getDietPlan(planId);
      if (!existingPlan) {
        return createErrorResponse<DietPlan>('Diet plan not found', 'Cannot regenerate non-existent plan');
      }

      // Merge existing data with modifications
      const updatedDto: GenerateDietDto = {
        userId: existingPlan.userId,
        calories: modifications.calories || existingPlan.totalCalories,
        goal: modifications.goal || existingPlan.goal,
        restrictions: modifications.restrictions || existingPlan.restrictions,
        mealsPerDay: modifications.mealsPerDay,
        targetProtein: modifications.targetProtein,
        preferredFoods: modifications.preferredFoods,
        avoidFoods: modifications.avoidFoods,
        preferences: modifications.preferences,
      };

      // Generate new diet plan
      return await this.generateDiet(updatedDto);
    } catch (error) {
      this.logger.error('Error regenerating diet plan:', error);
      return createErrorResponse<DietPlan>(
        error.message,
        'Failed to regenerate diet plan'
      );
    }
  }

  async adjustCalories(planId: string, newCalories: number): Promise<ApiResponse<DietPlan>> {
    try {
      const existingPlan = await this.supabaseService.getDietPlan(planId);
      if (!existingPlan) {
        return createErrorResponse<DietPlan>('Diet plan not found', 'Cannot adjust calories for non-existent plan');
      }

      // Calculate scaling factor
      const scalingFactor = newCalories / existingPlan.totalCalories;

      // Scale meals and portions
      const adjustedMeals = existingPlan.meals.map(meal => ({
        ...meal,
        totalCalories: Math.round(meal.totalCalories * scalingFactor),
        items: meal.items.map(item => ({
          ...item,
          calories: Math.round(item.calories * scalingFactor),
          protein: item.protein ? Math.round(item.protein * scalingFactor) : undefined,
          carbs: item.carbs ? Math.round(item.carbs * scalingFactor) : undefined,
          fat: item.fat ? Math.round(item.fat * scalingFactor) : undefined,
        })),
        macros: {
          protein: Math.round(meal.macros.protein * scalingFactor),
          carbs: Math.round(meal.macros.carbs * scalingFactor),
          fat: Math.round(meal.macros.fat * scalingFactor),
          fiber: meal.macros.fiber ? Math.round(meal.macros.fiber * scalingFactor) : undefined,
        },
      }));

      // Create adjusted diet plan
      const adjustedPlan: Partial<DietPlan> = {
        ...existingPlan,
        totalCalories: newCalories,
        meals: adjustedMeals,
        targetMacros: this.calculateTotalMacros(adjustedMeals),
      };

      // Save adjusted plan
      const savedDiet = await this.supabaseService.saveDietPlan(adjustedPlan);

      return createSuccessResponse(savedDiet, 'Diet plan calories adjusted successfully');
    } catch (error) {
      this.logger.error('Error adjusting diet calories:', error);
      return createErrorResponse<DietPlan>(
        error.message,
        'Failed to adjust diet calories'
      );
    }
  }

  private async processDietPlan(dto: GenerateDietDto, aiResponse: any): Promise<ApiResponse<DietPlan>> {
    // Calculate total macros from meals
    const totalMacros = this.calculateTotalMacros(aiResponse.meals);

    // Create diet plan object
    const dietPlan: Partial<DietPlan> = {
      userId: dto.userId,
      name: aiResponse.name,
      description: aiResponse.description,
      goal: dto.goal,
      totalCalories: dto.calories,
      targetMacros: totalMacros,
      meals: aiResponse.meals,
      restrictions: dto.restrictions || [],
    };

    // Save to Supabase
    const savedDiet = await this.supabaseService.saveDietPlan(dietPlan);

    this.logger.log(`Diet plan generated successfully for user: ${dto.userId}, ID: ${savedDiet.id}`);

    return createSuccessResponse(savedDiet, 'Diet plan generated successfully');
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      // Obtener perfil del usuario desde Supabase
      const userProfile = await this.supabaseService.getUserProfile(userId);
      return userProfile;
    } catch (error) {
      this.logger.warn(`Could not fetch user profile for ${userId}:`, error);
      // Return null if profile not found, so we can continue with basic generation
      return null;
    }
  }

  // Método para generar receta personalizada basada en el proyecto de referencia
  async generatePersonalizedRecipe(userId: string, mealType: string): Promise<ApiResponse<any>> {
    try {
      this.logger.log(`Generating personalized recipe for user: ${userId}, meal type: ${mealType}`);

      // Obtener perfil del usuario
      let userProfile = await this.getUserProfile(userId);
      
      // Si no hay perfil, usar uno por defecto para generar receta básica
      if (!userProfile) {
        this.logger.warn(`No profile found for user ${userId}, using default profile`);
        userProfile = {
          age: 30,
          weight: 70,
          height: 170,
          gender: 'masculino',
          activityLevel: 'moderado',
          fitnessGoals: ['mantener_peso'],
          medicalConditions: [],
          preferences: {
            dietaryRestrictions: []
          }
        };
      }

      // Generar receta personalizada con Gemini
      const recipeData = await this.geminiProvider.generatePersonalizedRecipe(userProfile, mealType);

      // Guardar receta en base de datos (opcional)
      const savedRecipe = {
        ...recipeData,
        userId,
        createdAt: new Date().toISOString()
      };

      return createSuccessResponse(savedRecipe, 'Receta personalizada generada exitosamente');

    } catch (error) {
      this.logger.error('Error generating personalized recipe:', error);
      return createErrorResponse('Error al generar receta personalizada');
    }
  }

  private calculateTotalMacros(meals: any[]): any {
    return meals.reduce(
      (total, meal) => ({
        protein: total.protein + meal.macros.protein,
        carbs: total.carbs + meal.macros.carbs,
        fat: total.fat + meal.macros.fat,
        fiber: total.fiber + (meal.macros.fiber || 0),
      }),
      { protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }
}