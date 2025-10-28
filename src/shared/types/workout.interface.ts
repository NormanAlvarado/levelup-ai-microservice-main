export interface Exercise {
  id?: string;
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  duration?: string;
  restTime?: string;
  instructions?: string;
  targetMuscles?: string[];
  equipment?: string;
}

export interface WorkoutDay {
  dayNumber: number;
  dayName: string;
  exercises: Exercise[];
  focusArea?: string;
}

export enum WorkoutGoal {
  LOSE_WEIGHT = 'lose_weight',
  GAIN_MUSCLE = 'gain_muscle',
  IMPROVE_ENDURANCE = 'improve_endurance',
  MAINTAIN_FITNESS = 'maintain_fitness',
  STRENGTH_TRAINING = 'strength_training',
  FLEXIBILITY = 'flexibility',
}

export enum WorkoutDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export interface WorkoutPlan {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  difficulty: WorkoutDifficulty;
  goal: WorkoutGoal;
  daysPerWeek: number;
  estimatedDuration: number;
  exercises?: Exercise[]; // For backward compatibility
  days?: WorkoutDay[]; // New format: exercises organized by days
  createdAt?: Date;
  updatedAt?: Date;
}