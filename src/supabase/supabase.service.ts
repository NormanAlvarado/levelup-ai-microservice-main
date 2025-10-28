import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WorkoutPlan } from '../shared/types/workout.interface';
import { DietPlan } from '../shared/types/diet.interface';
import { Recommendation } from '../shared/types/user.interface';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.serviceKey');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async saveWorkoutPlan(workoutPlan: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
    try {
      const { data, error } = await this.supabase
        .from('workout_routines')
        .insert([
          {
            user_id: workoutPlan.userId,
            name: workoutPlan.name,
            description: workoutPlan.description,
            difficulty_level: workoutPlan.difficulty,
            goal: workoutPlan.goal,
            days_per_week: workoutPlan.daysPerWeek,
            generated_by_ai: true,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) {
        this.logger.error('Error saving workout plan:', error);
        throw new Error(`Failed to save workout plan: ${error.message}`);
      }

      this.logger.log(`=== WORKOUT PLAN SAVED ===`);
      this.logger.log(`Routine ID: ${data.id}`);
      this.logger.log(`Has exercises field: ${!!workoutPlan.exercises}`);
      this.logger.log(`Exercises count: ${workoutPlan.exercises?.length || 0}`);
      this.logger.log(`Has days field: ${!!workoutPlan.days}`);
      this.logger.log(`Days count: ${workoutPlan.days?.length || 0}`);

      // Save exercises if they exist
      if (workoutPlan.exercises && workoutPlan.exercises.length > 0) {
        this.logger.log('Using LEGACY format (flat exercises array)');
        await this.saveWorkoutExercises(data.id, workoutPlan.exercises);
      } else if (workoutPlan.days && workoutPlan.days.length > 0) {
        this.logger.log('Using NEW format (days with exercises)');
        // New format: exercises organized by days
        await this.saveWorkoutExercisesByDays(data.id, workoutPlan.days);
      } else {
        this.logger.warn('No exercises or days found in workout plan!');
      }

      return {
        ...workoutPlan,
        id: data.id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      } as WorkoutPlan;
    } catch (error) {
      this.logger.error('Error in saveWorkoutPlan:', error);
      throw error;
    }
  }

  private async saveWorkoutExercises(routineId: string, exercises: any[]): Promise<void> {
    try {
      // Prepare all exercise data in parallel
      const exercisePromises = exercises.map(async (exercise, index) => {
        // Create or find exercise in exercises table
        const exerciseId = await this.findOrCreateExercise(exercise);
        
        // Parse reps (e.g., "10-12" or "30-60 seg")
        let repsMin = 10;
        let repsMax = 12;
        if (exercise.reps) {
          const repsMatch = exercise.reps.match(/(\d+)(?:-(\d+))?/);
          if (repsMatch) {
            repsMin = parseInt(repsMatch[1]);
            repsMax = repsMatch[2] ? parseInt(repsMatch[2]) : repsMin;
          }
        }

        // Parse rest time (e.g., "60-90 seg" or "60 seg")
        let restSeconds = 60;
        if (exercise.restTime) {
          const restMatch = exercise.restTime.match(/(\d+)/);
          if (restMatch) {
            restSeconds = parseInt(restMatch[1]);
          }
        }

        return {
          routine_id: routineId,
          exercise_id: exerciseId,
          day_of_week: 1, // Default to day 1, can be improved later
          order_in_day: index + 1,
          sets: exercise.sets || 3,
          reps_min: repsMin,
          reps_max: repsMax,
          rest_seconds: restSeconds,
          notes: exercise.instructions || null,
        };
      });

      // Wait for all exercises to be processed
      const routineExercises = await Promise.all(exercisePromises);

      // Insert all routine_exercises in one batch operation
      const { error: linkError } = await this.supabase
        .from('routine_exercises')
        .insert(routineExercises);

      if (linkError) {
        this.logger.error('Error linking exercises:', linkError);
      } else {
        this.logger.log(`Successfully linked ${routineExercises.length} exercises to routine ${routineId}`);
      }
    } catch (error) {
      this.logger.error('Error saving workout exercises:', error);
      // Don't throw - routine is already saved, exercises are optional
    }
  }

  private async saveWorkoutExercisesByDays(routineId: string, days: any[]): Promise<void> {
    try {
      this.logger.log(`=== SAVING EXERCISES BY DAYS ===`);
      this.logger.log(`Routine ID: ${routineId}`);
      this.logger.log(`Number of days: ${days?.length || 0}`);
      this.logger.log(`Days data: ${JSON.stringify(days)}`);
      
      const allExercisePromises: Promise<any>[] = [];
      
      // Process all days and their exercises
      for (const day of days) {
        const dayNumber = day.dayNumber || 1;
        const exercises = day.exercises || [];
        
        this.logger.log(`Processing day ${dayNumber} with ${exercises.length} exercises`);
        
        exercises.forEach((exercise, index) => {
          allExercisePromises.push(
            this.processExerciseForDay(routineId, exercise, dayNumber, index)
          );
        });
      }

      this.logger.log(`Total exercise promises to process: ${allExercisePromises.length}`);

      // Wait for all exercises to be processed in parallel
      const routineExercises = await Promise.all(allExercisePromises);

      this.logger.log(`Processed exercises: ${routineExercises.length}`);
      this.logger.log(`Sample exercise data: ${JSON.stringify(routineExercises[0])}`);

      // Insert all routine_exercises in one batch operation
      const { error: linkError } = await this.supabase
        .from('routine_exercises')
        .insert(routineExercises);

      if (linkError) {
        this.logger.error('Error linking exercises:', linkError);
        throw linkError; // Throw the error so we can see it in logs
      } else {
        this.logger.log(`Successfully linked ${routineExercises.length} exercises to routine ${routineId}`);
      }
    } catch (error) {
      this.logger.error('Error saving workout exercises by days:', error);
      this.logger.error('Error details:', JSON.stringify(error));
      // Don't throw - routine is already saved, exercises are optional
    }
  }

  private async processExerciseForDay(
    routineId: string, 
    exercise: any, 
    dayNumber: number, 
    orderInDay: number
  ): Promise<any> {
    // Create or find exercise in exercises table
    const exerciseId = await this.findOrCreateExercise(exercise);
    
    // Parse reps (e.g., "10-12" or "30-60 seg")
    let repsMin = 10;
    let repsMax = 12;
    if (exercise.reps) {
      const repsMatch = exercise.reps.match(/(\d+)(?:-(\d+))?/);
      if (repsMatch) {
        repsMin = parseInt(repsMatch[1]);
        repsMax = repsMatch[2] ? parseInt(repsMatch[2]) : repsMin;
      }
    }

    // Parse rest time (e.g., "60-90 seg" or "60 seg")
    let restSeconds = 60;
    if (exercise.restTime) {
      const restMatch = exercise.restTime.match(/(\d+)/);
      if (restMatch) {
        restSeconds = parseInt(restMatch[1]);
      }
    }

    return {
      routine_id: routineId,
      exercise_id: exerciseId,
      day_of_week: dayNumber,
      order_in_day: orderInDay + 1,
      sets: exercise.sets || 3,
      reps_min: repsMin,
      reps_max: repsMax,
      rest_seconds: restSeconds,
      notes: exercise.instructions || null,
    };
  }

  private async findOrCreateExercise(exerciseData: any): Promise<string> {
    try {
      // Use upsert to avoid race conditions and speed up the process
      const exerciseName = exerciseData.name.trim();
      
      // First try to find existing
      const { data: existing } = await this.supabase
        .from('exercises')
        .select('id')
        .ilike('name', exerciseName)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return existing.id;
      }

      // Create new exercise
      const { data: newExercise, error: createError } = await this.supabase
        .from('exercises')
        .insert({
          name: exerciseName,
          category: 'ai_generated',
          muscle_groups: exerciseData.targetMuscles || [],
          equipment: this.inferEquipment(exerciseName),
          difficulty_level: 'beginner',
          description: exerciseData.instructions || '',
          instructions: exerciseData.instructions || '',
        })
        .select('id')
        .single();

      if (createError) {
        this.logger.error('Error creating exercise:', createError);
        // Return a fallback - try to find any exercise
        const { data: fallback } = await this.supabase
          .from('exercises')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (fallback) return fallback.id;
        throw createError;
      }

      return newExercise.id;
    } catch (error) {
      this.logger.error('Error in findOrCreateExercise:', error);
      throw error;
    }
  }

  private inferEquipment(exerciseName: string): string {
    const name = exerciseName.toLowerCase();
    if (name.includes('barra') || name.includes('barbell')) return 'barbell';
    if (name.includes('mancuerna') || name.includes('dumbbell')) return 'dumbbells';
    if (name.includes('máquina') || name.includes('machine')) return 'machine';
    if (name.includes('kettlebell')) return 'kettlebell';
    if (name.includes('trx')) return 'trx';
    if (name.includes('banda') || name.includes('band')) return 'resistance_band';
    return 'bodyweight';
  }

  async saveDietPlan(dietPlan: Partial<DietPlan>): Promise<DietPlan> {
    try {
      const { data, error } = await this.supabase
        .from('diet_plans')
        .insert([
          {
            user_id: dietPlan.userId,
            name: dietPlan.name,
            description: dietPlan.description,
            goal: dietPlan.goal,
            total_calories: dietPlan.totalCalories,
            target_macros: dietPlan.targetMacros,
            meals: dietPlan.meals,
            restrictions: dietPlan.restrictions,
          },
        ])
        .select()
        .single();

      if (error) {
        this.logger.error('Error saving diet plan:', error);
        throw new Error(`Failed to save diet plan: ${error.message}`);
      }

      return this.mapDietPlanFromDB(data);
    } catch (error) {
      this.logger.error('Error in saveDietPlan:', error);
      throw error;
    }
  }

  async saveRecommendations(recommendations: Partial<Recommendation>[]): Promise<Recommendation[]> {
    try {
      const dbRecommendations = recommendations.map((rec) => ({
        user_id: rec.userId,
        type: rec.type,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        category: rec.category,
        actionable: rec.actionable,
        metadata: rec.metadata,
      }));

      const { data, error } = await this.supabase
        .from('recommendations')
        .insert(dbRecommendations)
        .select();

      if (error) {
        this.logger.error('Error saving recommendations:', error);
        throw new Error(`Failed to save recommendations: ${error.message}`);
      }

      return data.map((rec) => this.mapRecommendationFromDB(rec));
    } catch (error) {
      this.logger.error('Error in saveRecommendations:', error);
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        this.logger.error('Error fetching user profile:', error);
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error('Error in getUserProfile:', error);
      throw error;
    }
  }

  async getWorkoutPlan(planId: string): Promise<WorkoutPlan | null> {
    try {
      const { data, error } = await this.supabase
        .from('workout_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        this.logger.error('Error fetching workout plan:', error);
        throw new Error(`Failed to fetch workout plan: ${error.message}`);
      }

      return this.mapWorkoutPlanFromDB(data);
    } catch (error) {
      this.logger.error('Error in getWorkoutPlan:', error);
      throw error;
    }
  }

  async getDietPlan(planId: string): Promise<DietPlan | null> {
    try {
      const { data, error } = await this.supabase
        .from('diet_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        this.logger.error('Error fetching diet plan:', error);
        throw new Error(`Failed to fetch diet plan: ${error.message}`);
      }

      return this.mapDietPlanFromDB(data);
    } catch (error) {
      this.logger.error('Error in getDietPlan:', error);
      throw error;
    }
  }

  private mapWorkoutPlanFromDB(data: any): WorkoutPlan {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      difficulty: data.difficulty,
      goal: data.goal,
      daysPerWeek: data.days_per_week,
      estimatedDuration: data.estimated_duration,
      exercises: data.exercises,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapDietPlanFromDB(data: any): DietPlan {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      goal: data.goal,
      totalCalories: data.total_calories,
      targetMacros: data.target_macros,
      meals: data.meals,
      restrictions: data.restrictions,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapRecommendationFromDB(data: any): Recommendation {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category,
      actionable: data.actionable,
      metadata: data.metadata,
      createdAt: data.created_at,
    };
  }
}