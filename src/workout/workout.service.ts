import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiProvider } from '../external-apis/openai.provider';
import { GeminiProvider } from '../external-apis/gemini.provider';
import { SupabaseService } from '../supabase/supabase.service';
import { GenerateWorkoutDto } from '../shared/dto/generate-workout.dto';
import { WorkoutPlan } from '../shared/types/workout.interface';
import { ApiResponse, createSuccessResponse, createErrorResponse } from '../shared/utils/api-response';

@Injectable()
export class WorkoutService {
  private readonly logger = new Logger(WorkoutService.name);

  constructor(
    private configService: ConfigService,
    private openAiProvider: OpenAiProvider,
    private geminiProvider: GeminiProvider,
    private supabaseService: SupabaseService,
  ) {}

  async generateWorkout(dto: GenerateWorkoutDto): Promise<ApiResponse<WorkoutPlan>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Generating workout for user: ${dto.userId}`);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate workout plan using selected AI provider
      let aiResponse;
      let model = '';
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateWorkoutPlan(dto);
        model = 'gemini-1.5-flash';
      } else {
        aiResponse = await this.openAiProvider.generateWorkoutPlan(dto);
        model = 'gpt-4o-mini';
      }

      const result = await this.processWorkoutPlan(dto, aiResponse);
      
      // Log successful generation
      if (result.success && result.data) {
        const processingTime = Date.now() - startTime;
        await this.supabaseService.saveAIGenerationLog({
          userId: dto.userId,
          requestType: 'workout',
          provider: provider as 'openai' | 'gemini' | 'anthropic',
          model,
          requestData: dto,
          responseData: result.data,
          success: true,
          latencyMs: processingTime,
          routineId: result.data.id,
        });
      }
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Log failed generation
      await this.supabaseService.saveAIGenerationLog({
        userId: dto.userId,
        requestType: 'workout',
        provider: provider as 'openai' | 'gemini' | 'anthropic',
        model: provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini',
        requestData: dto,
        responseData: null,
        success: false,
        errorMessage: error.message,
        latencyMs: processingTime,
      });
      
      this.logger.error('Error generating workout plan:', error);
      return createErrorResponse('Error al generar plan de entrenamiento');
    }
  }

  async generatePersonalizedWorkout(dto: GenerateWorkoutDto): Promise<ApiResponse<WorkoutPlan>> {
    const startTime = Date.now();
    try {
      this.logger.log(`Generating personalized workout for user: ${dto.userId}`);

      // Obtener perfil del usuario desde Supabase
      const userProfile = await this.getUserProfile(dto.userId);

      // Get AI provider from config
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Generate workout plan using selected AI provider with user profile
      let aiResponse;
      let model = '';
      if (provider === 'gemini') {
        aiResponse = await this.geminiProvider.generateWorkoutPlan(dto, userProfile);
        model = 'gemini-1.5-flash';
      } else {
        aiResponse = await this.openAiProvider.generateWorkoutPlan(dto);
        model = 'gpt-4o-mini';
      }

      const result = await this.processWorkoutPlan(dto, aiResponse);
      
      // Log successful generation
      if (result.success && result.data) {
        const processingTime = Date.now() - startTime;
        await this.supabaseService.saveAIGenerationLog({
          userId: dto.userId,
          requestType: 'workout',
          provider: provider as 'openai' | 'gemini' | 'anthropic',
          model,
          requestData: { ...dto, userProfile },
          responseData: result.data,
          success: true,
          latencyMs: processingTime,
          routineId: result.data.id,
        });
      }
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const provider = this.configService.get<string>('ai.defaultProvider') || 'gemini';
      
      // Log failed generation
      await this.supabaseService.saveAIGenerationLog({
        userId: dto.userId,
        requestType: 'workout',
        provider: provider as 'openai' | 'gemini' | 'anthropic',
        model: provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini',
        requestData: dto,
        responseData: null,
        success: false,
        errorMessage: error.message,
        latencyMs: processingTime,
      });
      
      this.logger.error('Error generating personalized workout plan:', error);
      return createErrorResponse('Error al generar plan de entrenamiento personalizado');
    }
  }

  async getWorkout(planId: string): Promise<ApiResponse<WorkoutPlan>> {
    try {
      const workoutPlan = await this.supabaseService.getWorkoutPlan(planId);
      
      if (!workoutPlan) {
        return createErrorResponse('Workout plan not found', 'The requested workout plan does not exist');
      }

      return createSuccessResponse(workoutPlan);
    } catch (error) {
      this.logger.error('Error fetching workout:', error);
      return createErrorResponse(
        error.message,
        'Failed to fetch workout plan'
      );
    }
  }

  async regenerateWorkout(planId: string, modifications: Partial<GenerateWorkoutDto>): Promise<ApiResponse<WorkoutPlan>> {
    try {
      // Get existing workout plan
      const existingPlan = await this.supabaseService.getWorkoutPlan(planId);
      if (!existingPlan) {
        return createErrorResponse('Workout plan not found', 'Cannot regenerate non-existent plan');
      }

      // Merge existing data with modifications
      const updatedDto: GenerateWorkoutDto = {
        userId: existingPlan.userId,
        goal: modifications.goal || existingPlan.goal,
        difficulty: modifications.difficulty || existingPlan.difficulty,
        daysPerWeek: modifications.daysPerWeek || existingPlan.daysPerWeek,
        duration: modifications.duration || existingPlan.estimatedDuration,
        equipment: modifications.equipment,
        targetMuscles: modifications.targetMuscles,
        preferences: modifications.preferences,
      };

      // Generate new workout
      return await this.generatePersonalizedWorkout(updatedDto);
    } catch (error) {
      this.logger.error('Error regenerating workout:', error);
      return createErrorResponse(
        error.message,
        'Failed to regenerate workout plan'
      );
    }
  }

  private async processWorkoutPlan(dto: GenerateWorkoutDto, aiResponse: any): Promise<ApiResponse<WorkoutPlan>> {
    // Create workout plan object
    const workoutPlan: Partial<WorkoutPlan> = {
      userId: dto.userId,
      name: aiResponse.name,
      description: aiResponse.description,
      difficulty: dto.difficulty,
      goal: dto.goal,
      daysPerWeek: dto.daysPerWeek,
      estimatedDuration: dto.duration,
      exercises: aiResponse.exercises,  // Legacy format (flat exercises)
      days: aiResponse.days,             // NEW: Day-based format
    };

    // Save to Supabase
    const savedWorkout = await this.supabaseService.saveWorkoutPlan(workoutPlan);

    this.logger.log(`Workout generated successfully for user: ${dto.userId}, ID: ${savedWorkout.id}`);

    return createSuccessResponse(savedWorkout, 'Workout plan generated successfully');
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