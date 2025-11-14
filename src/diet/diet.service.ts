import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiProvider } from '../external-apis/openai.provider';
import { GeminiProvider } from '../external-apis/gemini.provider';
import { SupabaseService } from '../supabase/supabase.service';
import { RateLimitService } from '../shared/services/rate-limit.service';
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
    private rateLimitService: RateLimitService,
  ) {}

  async generateDiet(dto: GenerateDietDto): Promise<ApiResponse<DietPlan>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Generating diet plan for user: ${dto.userId}`);

      // Check rate limits before generating
      await this.rateLimitService.checkAndIncrementTokens(dto.userId, 'diet');

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate diet plan using selected AI provider
      let aiResponse;
      let model = '';
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateDietPlan(dto);
        model = 'gemini-pro';
      } else {
        aiResponse = await this.openAiProvider.generateDietPlan(dto);
        model = 'gpt-4o-mini';
      }

      const result = await this.processDietPlan(dto, aiResponse);
      
      // Log successful generation
      if (result.success && result.data) {
        const latencyMs = Date.now() - startTime;
        await this.supabaseService.saveAIGenerationLog({
          userId: dto.userId,
          requestType: 'diet',
          provider: provider as 'openai' | 'gemini' | 'anthropic',
          model,
          requestData: dto,
          responseData: { mealsCount: aiResponse.meals?.length || 0 },
          success: true,
          latencyMs,
          dietPlanId: result.data.id,
        });
      }
      
      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Log error in AI generation
      await this.supabaseService.saveAIGenerationLog({
        userId: dto.userId,
        requestType: 'diet',
        provider: provider as 'openai' | 'gemini' | 'anthropic',
        model: provider === 'gemini' ? 'gemini-pro' : 'gpt-4o-mini',
        requestData: dto,
        responseData: null,
        success: false,
        errorMessage: error.message,
        latencyMs,
      });
      
      this.logger.error('Error generating diet plan:', error);
      return createErrorResponse('Error al generar plan dietético');
    }
  }

  async generatePersonalizedDiet(dto: GenerateDietDto): Promise<ApiResponse<DietPlan>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Generating personalized diet plan for user: ${dto.userId}`);

      // Obtener perfil del usuario desde Supabase
      const userProfile = await this.getUserProfile(dto.userId);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate diet plan using selected AI provider with user profile
      let aiResponse;
      let model: string;
      
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateDietPlan(dto, userProfile);
        model = 'gemini-pro';
      } else {
        aiResponse = await this.openAiProvider.generateDietPlan(dto);
        model = 'gpt-4o-mini';
      }

      const latencyMs = Date.now() - startTime;

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

      // Log AI generation
      await this.supabaseService.saveAIGenerationLog({
        userId: dto.userId,
        requestType: 'diet',
        provider: provider as 'openai' | 'gemini',
        model,
        requestData: dto,
        responseData: { mealsCount: aiResponse.meals.length },
        success: true,
        latencyMs,
        dietPlanId: savedDiet.id,
      });

      this.logger.log(`Diet plan generated successfully for user: ${dto.userId}, ID: ${savedDiet.id}`);

      return createSuccessResponse(savedDiet, 'Diet plan generated successfully');
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      // Log error in AI generation
      await this.supabaseService.saveAIGenerationLog({
        userId: dto.userId,
        requestType: 'diet',
        provider: this.configService.get<string>('ai.defaultProvider') as 'openai' | 'gemini' || 'gemini',
        model: 'unknown',
        requestData: dto,
        responseData: null,
        success: false,
        errorMessage: error.message,
        latencyMs,
      });

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
        // Ensure targetProtein is a number and within allowed bounds (50 - 300)
        targetProtein: (() => {
          const raw = modifications.targetProtein;
          if (raw == null) return undefined;
          const parsed = Number(raw);
          if (Number.isNaN(parsed)) return undefined;
          // Clamp to allowed range
          if (parsed < 50) return 50;
          if (parsed > 300) return 300;
          return Math.round(parsed);
        })(),
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
