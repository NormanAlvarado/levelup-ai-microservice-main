/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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

  // Mapeo de goals de inglés a español para la BD
  private readonly goalMapping: Record<string, string> = {
    // Workout goals
    'lose_weight': 'perder_peso',
    'gain_muscle': 'ganar_musculo',
    'maintain': 'mantener',
    'improve_endurance': 'resistencia',
    'general': 'general',
    // Diet goals
    'maintain_weight': 'mantener',
    'gain_weight': 'ganar_peso',
    'improve_health': 'mejorar_salud',
  };

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.serviceKey');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    // Create client with service_role key and options to bypass RLS
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });

    this.logger.log('✅ Supabase client initialized with service_role key');
  }

  async saveWorkoutPlan(
    workoutPlan: Partial<WorkoutPlan>,
  ): Promise<WorkoutPlan> {
    try {
      // Mapear goal de inglés a español
      const mappedGoal = workoutPlan.goal 
        ? this.goalMapping[workoutPlan.goal] || workoutPlan.goal 
        : null;

      this.logger.log(`Mapping goal: ${workoutPlan.goal} -> ${mappedGoal}`);

      // 0. Desactivar rutinas anteriores para crear historial
      this.logger.log(`🏋️ Desactivando rutinas anteriores del usuario ${workoutPlan.userId}`);
      const { error: deactivateError } = await this.supabase
        .from('workout_routines')
        .update({ is_active: false })
        .eq('user_id', workoutPlan.userId)
        .eq('is_active', true);

      if (deactivateError) {
        this.logger.warn('Warning desactivating old routines:', deactivateError);
        // No fallar, solo advertir
      }

      const { data, error } = await this.supabase
        .from('workout_routines')
        .insert([
          {
            user_id: workoutPlan.userId,
            name: workoutPlan.name,
            description: workoutPlan.description,
            difficulty_level: workoutPlan.difficulty,
            goal: mappedGoal,
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

  private async saveWorkoutExercises(
    routineId: string,
    exercises: any[],
  ): Promise<void> {
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
        this.logger.log(
          `Successfully linked ${routineExercises.length} exercises to routine ${routineId}`,
        );
      }
    } catch (error) {
      this.logger.error('Error saving workout exercises:', error);
      // Don't throw - routine is already saved, exercises are optional
    }
  }

  private async saveWorkoutExercisesByDays(
    routineId: string,
    days: any[],
  ): Promise<void> {
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

        this.logger.log(
          `Processing day ${dayNumber} with ${exercises.length} exercises`,
        );

        exercises.forEach((exercise, index) => {
          allExercisePromises.push(
            this.processExerciseForDay(routineId, exercise, dayNumber, index),
          );
        });
      }

      this.logger.log(
        `Total exercise promises to process: ${allExercisePromises.length}`,
      );

      // Wait for all exercises to be processed in parallel
      const routineExercises = await Promise.all(allExercisePromises);

      this.logger.log(`Processed exercises: ${routineExercises.length}`);
      this.logger.log(
        `Sample exercise data: ${JSON.stringify(routineExercises[0])}`,
      );

      // Insert all routine_exercises in one batch operation
      const { error: linkError } = await this.supabase
        .from('routine_exercises')
        .insert(routineExercises);

      if (linkError) {
        this.logger.error('Error linking exercises:', linkError);
        throw linkError; // Throw the error so we can see it in logs
      } else {
        this.logger.log(
          `Successfully linked ${routineExercises.length} exercises to routine ${routineId}`,
        );
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
    orderInDay: number,
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return newExercise.id;
    } catch (error) {
      this.logger.error('Error in findOrCreateExercise:', error);
      throw error;
    }
  }

  private inferEquipment(exerciseName: string): string {
    const name = exerciseName.toLowerCase();
    if (name.includes('barra') || name.includes('barbell')) return 'barbell';
    if (name.includes('mancuerna') || name.includes('dumbbell'))
      return 'dumbbells';
    if (name.includes('máquina') || name.includes('machine')) return 'machine';
    if (name.includes('kettlebell')) return 'kettlebell';
    if (name.includes('trx')) return 'trx';
    if (name.includes('banda') || name.includes('band'))
      return 'resistance_band';
    return 'bodyweight';
  }

  async saveDietPlan(dietPlan: Partial<DietPlan>): Promise<DietPlan> {
    try {
      // Mapear goal de inglés a español para diet plans
      const mappedGoal = dietPlan.goal 
        ? this.goalMapping[dietPlan.goal] || dietPlan.goal 
        : null;

      this.logger.log(`Mapping diet goal: ${dietPlan.goal} -> ${mappedGoal}`);

      // 0. Desactivar planes anteriores para crear historial
      this.logger.log(`📋 Desactivando planes anteriores del usuario ${dietPlan.userId}`);
      const { error: deactivateError } = await this.supabase
        .from('diet_plans')
        .update({ is_active: false })
        .eq('user_id', dietPlan.userId)
        .eq('is_active', true);

      if (deactivateError) {
        this.logger.warn('Warning desactivating old plans:', deactivateError);
        // No fallar, solo advertir
      }

      // 1. Guardar el plan de dieta (sin meals)
      const { data: savedPlan, error: planError } = await this.supabase
        .from('diet_plans')
        .insert([
          {
            user_id: dietPlan.userId,
            name: dietPlan.name,
            description: dietPlan.description,
            goal: mappedGoal,
            target_calories: dietPlan.totalCalories,
            target_protein_g: dietPlan.targetMacros?.protein || 0,
            target_carbs_g: dietPlan.targetMacros?.carbs || 0,
            target_fat_g: dietPlan.targetMacros?.fat || 0,
            generated_by_ai: true,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (planError) {
        this.logger.error('Error saving diet plan:', planError);
        throw new Error(`Failed to save diet plan: ${planError.message}`);
      }

      // 2. Guardar las comidas asociadas al plan
      // La IA puede generar comidas para toda la semana (ej: 28 comidas = 4 × 7 días) o solo para un día (4 comidas)
      if (dietPlan.meals && dietPlan.meals.length > 0) {
        this.logger.log(`📋 Procesando ${dietPlan.meals.length} comidas generadas por la IA`);
        
        const mealsToInsert: Array<{
          diet_plan_id: string;
          meal_type: string;
          day_of_week: number;
          name: string;
          description: string;
          preparation_time_minutes: number;
          recipe_instructions: string;
          order_in_day: number;
        }> = [];
        
        // Detectar si la IA generó comidas para toda la semana o solo para un día
        const totalMeals = dietPlan.meals.length;
        const isWeeklyPlan = totalMeals >= 21; // Si hay 21+ comidas, asumimos plan semanal (3-5 comidas × 7 días)
        
        if (isWeeklyPlan) {
          // La IA generó comidas para toda la semana
          const mealsPerDay = Math.round(totalMeals / 7);
          this.logger.log(`📊 Plan semanal detectado: ${mealsPerDay} comidas por día × 7 días`);
          
          // Distribuir las comidas directamente (ya vienen variadas por día)
          for (let day = 1; day <= 7; day++) {
            const startIndex = (day - 1) * mealsPerDay;
            const endIndex = startIndex + mealsPerDay;
            const dayMeals = dietPlan.meals.slice(startIndex, endIndex);
            
            dayMeals.forEach((meal, mealIndex) => {
              mealsToInsert.push({
                diet_plan_id: savedPlan.id,
                meal_type: this.inferMealType(meal.name),
                day_of_week: day,
                name: meal.name,
                description: meal.items
                  ?.map((item) => `${item.name} (${item.quantity})`)
                  .join(', '),
                preparation_time_minutes: meal.prepTime || 30,
                recipe_instructions:
                  meal.instructions || 'Preparar según indicaciones',
                order_in_day: mealIndex + 1,
              });
            });
          }
        } else {
          // La IA generó comidas solo para un día - replicar para toda la semana
          const mealsPerDay = totalMeals;
          this.logger.log(`📊 Plan diario detectado: ${mealsPerDay} comidas - replicando para 7 días`);
          
          for (let day = 1; day <= 7; day++) {
            dietPlan.meals.forEach((meal, mealIndex) => {
              mealsToInsert.push({
                diet_plan_id: savedPlan.id,
                meal_type: this.inferMealType(meal.name),
                day_of_week: day,
                name: meal.name,
                description: meal.items
                  ?.map((item) => `${item.name} (${item.quantity})`)
                  .join(', '),
                preparation_time_minutes: meal.prepTime || 30,
                recipe_instructions:
                  meal.instructions || 'Preparar según indicaciones',
                order_in_day: mealIndex + 1,
              });
            });
          }
        }

        this.logger.log(`📊 Total de comidas a insertar: ${mealsToInsert.length} distribuidas en 7 días`);
        
        const { data: insertedMeals, error: mealsError } = await this.supabase
          .from('diet_meals')
          .insert(mealsToInsert)
          .select();

        if (mealsError) {
          this.logger.error('❌ Error saving diet meals:', mealsError);
          // No lanzar error aquí, el plan ya fue guardado
        } else {
          this.logger.log(`✅ Comidas guardadas exitosamente: ${insertedMeals?.length || 0} comidas`);
          
          // 3. Procesar y guardar los alimentos individuales en la tabla foods y diet_meal_foods
          if (insertedMeals && insertedMeals.length > 0) {
            await this.processMealFoods(dietPlan.meals, insertedMeals);
          }
        }
      }

      // 3. Devolver el plan guardado con los datos completos
      return {
        id: savedPlan.id,
        userId: savedPlan.user_id,
        name: savedPlan.name,
        description: savedPlan.description,
        goal: savedPlan.goal,
        totalCalories: savedPlan.target_calories,
        targetMacros: {
          protein: savedPlan.target_protein_g || 0,
          carbs: savedPlan.target_carbs_g || 0,
          fat: savedPlan.target_fat_g || 0,
          fiber: 0,
        },
        meals: dietPlan.meals || [],
        restrictions: dietPlan.restrictions || [],
        createdAt: savedPlan.created_at,
        updatedAt: savedPlan.updated_at,
      };
    } catch (error) {
      this.logger.error('Error in saveDietPlan:', error);
      throw error;
    }
  }

  private inferMealType(mealName: string): string {
    const name = mealName.toLowerCase();
    if (name.includes('desayuno') || name.includes('breakfast'))
      return 'breakfast';
    if (
      name.includes('almuerzo') ||
      name.includes('comida') ||
      name.includes('lunch')
    )
      return 'lunch';
    if (name.includes('cena') || name.includes('dinner')) return 'dinner';
    if (
      name.includes('snack') ||
      name.includes('colación') ||
      name.includes('merienda')
    )
      return 'snack';
    return 'snack';
  }

  /**
   * Procesa los alimentos individuales de cada comida y los guarda en la base de datos
   * - Busca si el alimento ya existe en la tabla 'foods'
   * - Si no existe, lo crea con la información nutricional de la IA
   * - Crea la relación en 'diet_meal_foods'
   */
  private async processMealFoods(meals: any[], insertedMeals: any[]): Promise<void> {
    try {
      this.logger.log(`🍎 Procesando alimentos individuales de ${insertedMeals.length} comidas insertadas`);
      let totalFoodsProcessed = 0;
      let newFoodsCreated = 0;

      // Ahora insertedMeals tiene 28 comidas (4 comidas × 7 días)
      // Necesitamos mapear cada comida insertada a su meal original basándonos en order_in_day
      for (const insertedMeal of insertedMeals) {
        if (!insertedMeal?.id || !insertedMeal?.order_in_day) continue;
        
        // Obtener la comida original basándonos en order_in_day (1-based index)
        const mealIndex = insertedMeal.order_in_day - 1;
        const meal = meals[mealIndex];

        if (!meal || !meal.items || meal.items.length === 0) continue;

        for (const item of meal.items) {
          // Normalizar nombre del alimento
          const normalizedName = item.name.trim();
          const category = this.inferFoodCategory(normalizedName);
          
          // Buscar si el alimento ya existe
          const { data: existingFood } = await this.supabase
            .from('foods')
            .select('id')
            .eq('name', normalizedName)
            .single();

          let foodId: string;

          if (existingFood) {
            // Usar el alimento existente
            foodId = existingFood.id;
            this.logger.log(`♻️  Usando alimento existente: ${normalizedName}`);
          } else {
            // Crear nuevo alimento
            const { data: newFood, error: foodError } = await this.supabase
              .from('foods')
              .insert([{
                name: normalizedName,
                category: category,
                calories_per_100g: item.calories || 0,
                protein_per_100g: item.protein || 0,
                carbs_per_100g: item.carbs || 0,
                fat_per_100g: item.fat || 0,
                fiber_per_100g: item.fiber || 0,
                is_common: true,
              }])
              .select('id')
              .single();

            if (foodError || !newFood) {
              this.logger.error(`❌ Error creating food '${normalizedName}':`, foodError);
              continue;
            }

            foodId = newFood.id;
            newFoodsCreated++;
            this.logger.log(`✅ Nuevo alimento creado: ${normalizedName}`);
          }

          // 3. Crear la relación en diet_meal_foods
          // Extraer cantidad en gramos del string quantity (ej: "100g" -> 100)
          const quantityGrams = this.parseQuantityToGrams(item.quantity);

          const { error: relationError } = await this.supabase
            .from('diet_meal_foods')
            .insert([{
              meal_id: insertedMeal.id,
              food_id: foodId,
              quantity_grams: quantityGrams,
              notes: item.quantity, // Guardar la cantidad original como nota
            }]);

          if (relationError) {
            this.logger.error(`❌ Error creating meal-food relation:`, relationError);
          } else {
            totalFoodsProcessed++;
          }
        }
      }

      this.logger.log(`✅ Alimentos procesados: ${totalFoodsProcessed} | Nuevos creados: ${newFoodsCreated}`);
    } catch (error) {
      this.logger.error('❌ Error processing meal foods:', error);
    }
  }

  /**
   * Infiere la categoría del alimento basándose en su nombre
   */
  private inferFoodCategory(foodName: string): string {
    const name = foodName.toLowerCase();
    
    // Proteínas
    if (name.includes('pollo') || name.includes('pavo') || name.includes('carne') || 
        name.includes('pescado') || name.includes('atún') || name.includes('salmón') ||
        name.includes('huevo') || name.includes('tofu')) {
      return 'Proteínas';
    }
    
    // Lácteos
    if (name.includes('leche') || name.includes('yogur') || name.includes('queso')) {
      return 'Lácteos';
    }
    
    // Granos y cereales
    if (name.includes('arroz') || name.includes('avena') || name.includes('pan') ||
        name.includes('pasta') || name.includes('quinoa') || name.includes('cereal')) {
      return 'Granos';
    }
    
    // Frutas
    if (name.includes('manzana') || name.includes('plátano') || name.includes('naranja') ||
        name.includes('fresa') || name.includes('arándano') || name.includes('uva')) {
      return 'Frutas';
    }
    
    // Verduras
    if (name.includes('lechuga') || name.includes('tomate') || name.includes('brócoli') ||
        name.includes('zanahoria') || name.includes('espinaca') || name.includes('pepino')) {
      return 'Verduras';
    }
    
    // Frutos secos y semillas
    if (name.includes('nuez') || name.includes('almendra') || name.includes('semilla')) {
      return 'Frutos Secos';
    }
    
    // Aceites y grasas
    if (name.includes('aceite') || name.includes('mantequilla') || name.includes('aguacate')) {
      return 'Grasas';
    }
    
    return 'Otros';
  }

  /**
   * Parsea una cantidad en string a gramos
   * Ejemplos: "100g" -> 100, "1 taza" -> 240, "1 cucharada" -> 15
   */
  private parseQuantityToGrams(quantity: string): number {
    if (!quantity) return 100; // Default
    
    const quantityLower = quantity.toLowerCase();
    
    // Buscar número seguido de 'g' o 'gr'
    const gramsMatch = quantityLower.match(/(\d+\.?\d*)\s*(g|gr|gramos?)/);
    if (gramsMatch) return parseFloat(gramsMatch[1]);
    
    // Buscar número seguido de 'ml' (líquidos, asumir 1ml = 1g)
    const mlMatch = quantityLower.match(/(\d+\.?\d*)\s*(ml|mililitros?)/);
    if (mlMatch) return parseFloat(mlMatch[1]);
    
    // Conversiones aproximadas
    if (quantityLower.includes('taza')) return 240;
    if (quantityLower.includes('cucharada')) return 15;
    if (quantityLower.includes('cucharadita')) return 5;
    if (quantityLower.includes('mediano') || quantityLower.includes('media')) return 150;
    if (quantityLower.includes('pequeño') || quantityLower.includes('pequeña')) return 100;
    if (quantityLower.includes('grande')) return 200;
    
    // Buscar cualquier número
    const numberMatch = quantityLower.match(/(\d+\.?\d*)/);
    if (numberMatch) return parseFloat(numberMatch[1]);
    
    return 100; // Default fallback
  }

  private inferDayOfWeek(mealName: string, index: number): number {
    // Si el nombre incluye un día, extraerlo
    const name = mealName.toLowerCase();
    if (name.includes('lunes') || name.includes('monday')) return 1;
    if (name.includes('martes') || name.includes('tuesday')) return 2;
    if (name.includes('miércoles') || name.includes('wednesday')) return 3;
    if (name.includes('jueves') || name.includes('thursday')) return 4;
    if (name.includes('viernes') || name.includes('friday')) return 5;
    if (name.includes('sábado') || name.includes('saturday')) return 6;
    if (name.includes('domingo') || name.includes('sunday')) return 7;

    // Si no especifica día, distribuir las comidas equitativamente en los 7 días
    // Usar módulo para ciclar: meal 0->día 1, meal 1->día 2, ..., meal 7->día 1, etc.
    return (index % 7) + 1;
  }

  async saveRecommendations(
    recommendations: Partial<Recommendation>[],
  ): Promise<Recommendation[]> {
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

  /**
   * Guarda un log de generación de IA (adaptado a la estructura real de la DB)
   */
  async saveAIGenerationLog(logData: {
    userId: string;
    requestType: 'workout' | 'diet' | 'recommendation' | 'analysis' | 'recipe' | 'motivation';
    provider: 'openai' | 'gemini' | 'anthropic';
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    requestData?: any;
    responseData?: any;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
    routineId?: string;
    dietPlanId?: string;
  }): Promise<void> {
    try {
      // Map requestType to valid generation_type values
      let generationType: 'workout_routine' | 'diet_plan' | 'recommendation' | 'motivation';
      if (logData.requestType === 'workout' || logData.requestType === 'analysis') {
        generationType = 'workout_routine';
      } else if (logData.requestType === 'diet') {
        generationType = 'diet_plan';
      } else if (logData.requestType === 'recommendation') {
        generationType = 'recommendation';
      } else if (logData.requestType === 'motivation') {
        generationType = 'motivation';
      } else {
        generationType = 'workout_routine'; // default
      }

      // Convertir requestData y responseData a texto JSON para el campo prompt_used y response_received
      const promptUsed = JSON.stringify(logData.requestData || {}, null, 2);
      const responseReceived = logData.responseData 
        ? JSON.stringify(logData.responseData, null, 2) 
        : null;

      const { error } = await this.supabase
        .from('ai_generation_logs')
        .insert([
          {
            user_id: logData.userId,
            generation_type: generationType,
            ai_model: logData.model,
            prompt_used: promptUsed,
            response_received: responseReceived,
            routine_id: logData.routineId || null,
            diet_plan_id: logData.dietPlanId || null,
            processing_time_ms: logData.latencyMs || null,
            tokens_used: logData.totalTokens || null,
            success: logData.success,
            error_message: logData.errorMessage || null,
          },
        ]);

      if (error) {
        this.logger.error('Error saving AI generation log:', error);
        // No lanzamos error porque es un log secundario
      } else {
        this.logger.log(`✅ AI generation log saved for user ${logData.userId} (${logData.requestType} -> ${generationType})`);
      }
    } catch (error) {
      this.logger.error('Error in saveAIGenerationLog:', error);
      // No lanzamos error porque es un log secundario
    }
  }
}
