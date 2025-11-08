import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiProvider } from '../external-apis/openai.provider';
import { GeminiProvider } from '../external-apis/gemini.provider';
import { SupabaseService } from '../supabase/supabase.service';
import { RecommendationDto } from '../shared/dto/recommendation.dto';
import { Recommendation } from '../shared/types/user.interface';
import { ApiResponse, createSuccessResponse, createErrorResponse } from '../shared/utils/api-response';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private configService: ConfigService,
    private openAiProvider: OpenAiProvider,
    private geminiProvider: GeminiProvider,
    private supabaseService: SupabaseService,
  ) {}

  async generateRecommendations(dto: RecommendationDto): Promise<ApiResponse<Recommendation[]>> {
    try {
      this.logger.log(`Generating recommendations for user: ${dto.userId}`);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate recommendations using selected AI provider
      let aiResponse;
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateRecommendations(dto);
      } else {
        aiResponse = await this.openAiProvider.generateRecommendations(dto);
      }

      return await this.processRecommendations(dto, aiResponse);
    } catch (error) {
      this.logger.error('Error generating recommendations:', error);
      return createErrorResponse('Error al generar recomendaciones');
    }
  }

  async generatePersonalizedRecommendations(dto: RecommendationDto): Promise<ApiResponse<Recommendation[]>> {
    try {
      this.logger.log(`Generating personalized recommendations for user: ${dto.userId}`);

      // Obtener perfil del usuario desde Supabase
      const userProfile = await this.getUserProfile(dto.userId);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate recommendations using selected AI provider with user profile
      let aiResponse;
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateRecommendations(dto, userProfile);
      } else {
        aiResponse = await this.openAiProvider.generateRecommendations(dto);
      }

      return await this.processRecommendations(dto, aiResponse);
    } catch (error) {
      this.logger.error('Error generating personalized recommendations:', error);
      return createErrorResponse('Error al generar recomendaciones personalizadas');
    }
  }

  async getPersonalizedInsights(
    userId: string,
    workoutId?: string,
    dietId?: string
  ): Promise<ApiResponse<any>> {
    try {
      this.logger.log(`Generating personalized insights for user: ${userId}`);

      // Get user profile and plans from Supabase
      const userProfile = await this.supabaseService.getUserProfile(userId);
      const workoutPlan = workoutId ? await this.supabaseService.getWorkoutPlan(workoutId) : null;
      const dietPlan = dietId ? await this.supabaseService.getDietPlan(dietId) : null;

      // Create insights based on available data
      const insights = {
        userId,
        profileComplete: !!userProfile,
        hasWorkoutPlan: !!workoutPlan,
        hasDietPlan: !!dietPlan,
        workoutInsights: workoutPlan ? this.analyzeWorkoutPlan(workoutPlan) : null,
        dietInsights: dietPlan ? this.analyzeDietPlan(dietPlan) : null,
        generalTips: this.getGeneralTips(userProfile),
        nextSteps: this.suggestNextSteps(userProfile, workoutPlan, dietPlan),
      };

      return createSuccessResponse(insights, 'Personalized insights generated successfully');
    } catch (error) {
      this.logger.error('Error generating insights:', error);
      return createErrorResponse(
        error.message,
        'Failed to generate personalized insights'
      );
    }
  }

  async generateMotivationalContent(
    userId: string,
    context?: string
  ): Promise<ApiResponse<any>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Generating motivational content for user: ${userId}`);

      // Generate motivational messages directly (no AI needed for basic motivation)
      const motivationalMessages = [
        {
          title: '¡Sigue adelante!',
          description: 'Cada día de entrenamiento te acerca más a tus metas. Tu dedicación es admirable.',
          type: 'motivational',
          priority: 'medium'
        },
        {
          title: 'La constancia es clave',
          description: 'No se trata de ser perfecto, sino de ser consistente. Cada pequeño paso cuenta.',
          type: 'encouragement',
          priority: 'medium'
        },
        {
          title: 'Tu progreso es importante',
          description: 'Recuerda que el cambio lleva tiempo. Celebra cada logro, por pequeño que sea.',
          type: 'progress',
          priority: 'low'
        }
      ];

      this.logger.log('Getting daily tip...');
      const dailyTip = this.getDailyTip();
      
      this.logger.log('Getting inspirational quote...');
      const quote = this.getInspirationalQuote();

      const result = {
        userId,
        motivationalMessages,
        dailyTip,
        quote,
      };

      // Calcular tiempo de procesamiento
      const processingTime = Date.now() - startTime;

      // Guardar log en Supabase
      await this.supabaseService.saveAIGenerationLog({
        userId,
        requestType: 'motivation',
        provider: 'gemini',
        model: 'internal-motivation-v1',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        requestData: { context: context || 'general' },
        responseData: result,
        success: true,
        latencyMs: processingTime,
      });

      this.logger.log('Motivational content generated successfully');
      return createSuccessResponse(result, 'Motivational content generated successfully');
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Guardar log de error en Supabase
      await this.supabaseService.saveAIGenerationLog({
        userId,
        requestType: 'motivation',
        provider: 'gemini',
        model: 'internal-motivation-v1',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        requestData: { context: context || 'general' },
        responseData: null,
        success: false,
        errorMessage: error.message || 'Unknown error',
        latencyMs: processingTime,
      });

      this.logger.error('Error generating motivational content:', error);
      this.logger.error('Error stack:', error.stack);
      return createErrorResponse(
        error.message || 'Unknown error',
        'Failed to generate motivational content'
      );
    }
  }

  private analyzeWorkoutPlan(workoutPlan: any): any {
    return {
      totalExercises: workoutPlan.exercises?.length || 0,
      difficulty: workoutPlan.difficulty,
      estimatedBurn: this.estimateCalorieBurn(workoutPlan),
      muscleGroups: this.extractMuscleGroups(workoutPlan.exercises),
      recommendation: this.getWorkoutRecommendation(workoutPlan),
    };
  }

  private analyzeDietPlan(dietPlan: any): any {
    return {
      totalMeals: dietPlan.meals?.length || 0,
      dailyCalories: dietPlan.totalCalories,
      macroBalance: dietPlan.targetMacros,
      mealVariety: this.calculateMealVariety(dietPlan.meals),
      recommendation: this.getDietRecommendation(dietPlan),
    };
  }

  private getGeneralTips(userProfile: any): string[] {
    const tips = [
      'Mantente hidratado bebiendo al menos 8 vasos de agua diariamente',
      'Procura dormir de 7 a 9 horas cada noche para una recuperación óptima',
      'Calienta adecuadamente antes de cada entrenamiento',
      'Enfócate en la forma correcta antes de aumentar el peso',
      'Escucha a tu cuerpo y descansa cuando sea necesario',
      'Registra tu progreso para mantenerte motivado',
      'Come proteína suficiente para recuperación muscular',
      'Varía tus ejercicios para evitar estancamiento',
      'Incluye cardio y entrenamiento de fuerza en tu rutina',
      'Enfócate en alimentos integrales no procesados',
    ];

    return tips.slice(0, 3); // Return 3 random tips
  }

  private suggestNextSteps(userProfile: any, workoutPlan: any, dietPlan: any): string[] {
    const steps: string[] = [];

    if (!workoutPlan) {
      steps.push('Crea tu primer plan de entrenamiento personalizado');
    }
    if (!dietPlan) {
      steps.push('Genera un plan de nutrición alineado con tus objetivos');
    }
    if (workoutPlan && dietPlan) {
      steps.push('Registra tu progreso y actualiza tus planes según sea necesario');
      steps.push('Considera agregar variedad para prevenir estancamiento');
    }

    return steps;
  }

  private estimateCalorieBurn(workoutPlan: any): number {
    // Simple estimation based on duration and exercise count
    const baseBurn = workoutPlan.estimatedDuration * 8; // 8 calories per minute base
    const intensity = workoutPlan.difficulty === 'advanced' ? 1.3 : 
                     workoutPlan.difficulty === 'intermediate' ? 1.1 : 1.0;
    return Math.round(baseBurn * intensity);
  }

  private extractMuscleGroups(exercises: any[]): string[] {
    if (!exercises) return [];
    
    const muscleGroups = new Set<string>();
    exercises.forEach(exercise => {
      if (exercise.targetMuscles) {
        exercise.targetMuscles.forEach((muscle: string) => muscleGroups.add(muscle));
      }
    });
    
    return Array.from(muscleGroups);
  }

  private getWorkoutRecommendation(workoutPlan: any): string {
    const exerciseCount = workoutPlan.exercises?.length || 0;
    if (exerciseCount < 5) {
      return 'Considera agregar más ejercicios para un entrenamiento completo';
    } else if (exerciseCount > 12) {
      return '¡Plan completo y bien estructurado! Asegúrate de descansar adecuadamente entre series';
    }
    return 'Plan de entrenamiento bien balanceado. Mantén la consistencia para mejores resultados';
  }

  private getDietRecommendation(dietPlan: any): string {
    const calories = dietPlan.totalCalories;
    if (calories < 1500) {
      return 'Considera aumentar las calorías para asegurar nutrición adecuada';
    } else if (calories > 3000) {
      return 'Plan alto en calorías - asegúrate de que se alinee con tu nivel de actividad';
    }
    return 'Distribución calórica balanceada. Enfócate en horarios de comidas consistentes';
  }

  private calculateMealVariety(meals: any[]): number {
    if (!meals) return 0;
    
    const uniqueIngredients = new Set<string>();
    meals.forEach(meal => {
      if (meal.items) {
        meal.items.forEach((item: any) => uniqueIngredients.add(item.name));
      }
    });
    
    return uniqueIngredients.size;
  }

  private getDailyTip(): string {
    const tips = [
      'Comienza tu día con un vaso de agua para activar tu metabolismo',
      'Usa las escaleras en lugar del elevador cuando sea posible',
      'Practica alimentación consciente masticando despacio y saboreando tu comida',
      'Haz una rutina de estiramiento de 5 minutos antes de dormir para mejor descanso',
      'Planifica tus comidas con anticipación para evitar opciones poco saludables',
      'Toma descansos activos durante el día para mantener la energía',
      'Mantén un registro de tus entrenamientos para ver tu progreso',
      'Come una fuente de proteína en cada comida principal',
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  private getInspirationalQuote(): string {
    const quotes = [
      '"El único mal entrenamiento es el que no sucedió." - Desconocido',
      '"Tu cuerpo puede hacerlo. Es tu mente la que tienes que convencer." - Desconocido',
      '"El éxito no se da. Se gana en el gimnasio." - Desconocido',
      '"La base de toda felicidad es la buena salud." - Leigh Hunt',
      '"Cuida tu cuerpo. Es el único lugar que tienes para vivir." - Jim Rohn',
      '"La disciplina es hacer lo que debe hacerse, cuando debe hacerse, tan bien como se puede hacer." - Desconocido',
      '"No cuentes los días, haz que los días cuenten." - Muhammad Ali',
      '"El dolor es temporal. El orgullo es para siempre." - Desconocido',
    ];
    
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  private async processRecommendations(dto: RecommendationDto, aiResponse: any): Promise<ApiResponse<Recommendation[]>> {
    // Convert AI response to Recommendation objects
    const recommendations: Partial<Recommendation>[] = aiResponse.recommendations.map((rec: any) => ({
      userId: dto.userId,
      type: rec.type,
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      category: rec.category,
      actionable: rec.actionable,
      metadata: rec.metadata || {},
    }));

    // Save to Supabase
    const savedRecommendations = await this.supabaseService.saveRecommendations(recommendations);

    this.logger.log(`Generated ${savedRecommendations.length} recommendations for user: ${dto.userId}`);

    return createSuccessResponse(savedRecommendations, 'Recommendations generated successfully');
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
}