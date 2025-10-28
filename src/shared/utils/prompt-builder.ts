import { GenerateWorkoutDto } from '../dto/generate-workout.dto';
import { GenerateDietDto } from '../dto/generate-diet.dto';
import { RecommendationDto } from '../dto/recommendation.dto';
import { UserProfile } from '../types/user.interface';

export function buildWorkoutPrompt(dto: GenerateWorkoutDto, userProfile?: UserProfile): string {
  // Procesar equipamiento y músculos objetivo
  const equipment = dto.equipment || [];
  const targetMuscles = dto.targetMuscles || [];
  const medicalConditions = userProfile?.medicalConditions || [];
  
  // Fecha actual para contexto
  const fecha = new Date().toLocaleDateString('es-ES');

  let prompt = `Quiero que generes un plan de entrenamiento personalizado y seguro en formato JSON válido, sin explicaciones ni justificaciones.
Debes crear un plan apropiado para el objetivo especificado: **${dto.goal}**.

Usa la siguiente estructura **estrictamente**:

{
  "name": "Nombre del plan de entrenamiento",
  "description": "Descripción detallada del plan",
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Día 1 - Tren Superior",
      "exercises": [
        {
          "name": "Nombre del ejercicio",
          "sets": 3,
          "reps": "8-12",
          "restTime": "60-90 seg",
          "instructions": "Instrucciones claras para ejecutar el ejercicio",
          "targetMuscles": ["músculo1", "músculo2"]
        }
      ]
    }
  ]
}

🏋️ Especificaciones del entrenamiento:
- Objetivo principal: ${dto.goal}
- Nivel de dificultad: ${dto.difficulty}
- Días de entrenamiento por semana: ${dto.daysPerWeek}
- Duración por sesión: ${dto.duration} minutos
- Equipamiento disponible: ${equipment.length ? equipment.join(', ') : 'peso corporal y básico'}
- Músculos objetivo: ${targetMuscles.length ? targetMuscles.join(', ') : 'entrenamiento completo'}`;

  // Agregar información del perfil de usuario si está disponible
  if (userProfile) {
    prompt += `

🧍 Datos del usuario:
- Edad: ${userProfile.age} años
- Peso: ${userProfile.weight} kg
- Altura: ${userProfile.height} cm
- Género: ${userProfile.gender}
- Nivel de actividad: ${userProfile.activityLevel}`;
  }

  prompt += `

✅ Condiciones médicas a considerar: ${medicalConditions.length ? medicalConditions.join(', ') : 'ninguna'}`;

  if (dto.preferences) {
    prompt += `
💭 Preferencias adicionales: ${dto.preferences}`;
  }

  prompt += `

📅 Fecha de generación: ${fecha}

⚠️ IMPORTANTE:
- Responde **solo** con un objeto JSON válido.
- No incluyas explicaciones, comentarios, ni texto adicional.
- No uses backticks, markdown ni formato de código.
- El plan debe ser realista y seguro para el nivel ${dto.difficulty}.
- Debes crear exactamente ${dto.daysPerWeek} días de entrenamiento en el array "days".
- Cada día debe tener entre 4-7 ejercicios apropiados para ${dto.duration} minutos.
- Distribuye los ejercicios para trabajar diferentes grupos musculares en diferentes días.
- Los ejercicios deben ser variados y enfocados en ${dto.goal}.
- Las repeticiones y series deben ser apropiadas para el nivel.
- Los tiempos de descanso deben ser realistas.
- Ejemplo de distribución: Día 1: Tren Superior, Día 2: Tren Inferior, Día 3: Full Body, etc.`;

  return prompt;
}

export function buildDietPrompt(dto: GenerateDietDto, userProfile?: UserProfile): string {
  let prompt = `Genera un plan nutricional personalizado con las siguientes especificaciones:

📊 DATOS NUTRICIONALES:
- Objetivo: ${dto.goal}
- Calorías diarias: ${dto.calories}
- Comidas por día: ${dto.mealsPerDay || 4}`;

  // Agregar información del perfil de usuario si está disponible
  if (userProfile) {
    prompt += `
- Edad: ${userProfile.age} años
- Peso: ${userProfile.weight} kg
- Altura: ${userProfile.height} cm
- Género: ${userProfile.gender}
- Nivel de actividad: ${userProfile.activityLevel}`;

    if (userProfile.medicalConditions && userProfile.medicalConditions.length > 0) {
      prompt += `
- Condiciones médicas: ${userProfile.medicalConditions.join(', ')}`;
    }

    if (userProfile.preferences?.dietaryRestrictions && userProfile.preferences.dietaryRestrictions.length > 0) {
      prompt += `
- Restricciones dietéticas del perfil: ${userProfile.preferences.dietaryRestrictions.join(', ')}`;
    }
  }

  if (dto.restrictions && dto.restrictions.length > 0) {
    prompt += `
- Restricciones dietéticas: ${dto.restrictions.join(', ')}`;
  }

  if (dto.targetProtein) {
    prompt += `
- Proteína objetivo: ${dto.targetProtein}g`;
  }

  if (dto.preferredFoods && dto.preferredFoods.length > 0) {
    prompt += `
- Alimentos preferidos: ${dto.preferredFoods.join(', ')}`;
  }

  if (dto.avoidFoods && dto.avoidFoods.length > 0) {
    prompt += `
- Alimentos a evitar: ${dto.avoidFoods.join(', ')}`;
  }

  if (dto.preferences) {
    prompt += `
- Preferencias adicionales: ${dto.preferences}`;
  }

  prompt += `

⚠️ IMPORTANTE:
- Responde **solo** con un objeto JSON válido
- No incluyas explicaciones, comentarios, ni texto adicional
- El plan debe ser balanceado y nutritivo
- Cumple estrictamente con las restricciones especificadas
- Calcula correctamente las macros de cada comida
- Asegúrate de que las cantidades sean realistas`;

  return prompt.trim();
}

export function buildRecommendationPrompt(dto: RecommendationDto, userProfile?: UserProfile): string {
  const { progressData } = dto;
  
  let prompt = `Analiza el progreso del usuario y genera recomendaciones personalizadas:

📈 DATOS DE PROGRESO:
- Entrenamientos completados: ${progressData.completedWorkouts}
- Tasa de adherencia: ${progressData.adherenceRate}%`;

  if (progressData.weightProgress !== undefined) {
    prompt += `
- Progreso de peso: ${progressData.weightProgress} kg`;
  }

  if (progressData.strengthProgress) {
    prompt += `
- Progreso de fuerza: ${JSON.stringify(progressData.strengthProgress)}`;
  }

  if (progressData.enduranceProgress !== undefined) {
    prompt += `
- Progreso de resistencia: ${progressData.enduranceProgress}%`;
  }

  // Agregar información del perfil de usuario si está disponible
  if (userProfile) {
    prompt += `

👤 PERFIL DEL USUARIO:
- Edad: ${userProfile.age} años
- Peso actual: ${userProfile.weight} kg
- Altura: ${userProfile.height} cm
- Objetivos: ${userProfile.fitnessGoals.join(', ')}`;

    if (userProfile.medicalConditions && userProfile.medicalConditions.length > 0) {
      prompt += `
- Condiciones médicas: ${userProfile.medicalConditions.join(', ')}`;
    }
  }

  if (progressData.feedback) {
    prompt += `
- Feedback del usuario: ${progressData.feedback}`;
  }

  if (dto.context) {
    prompt += `
- Contexto adicional: ${dto.context}`;
  }

  prompt += `

⚠️ IMPORTANTE:
- Responde **solo** con un objeto JSON válido
- No incluyas explicaciones, comentarios, ni texto adicional
- Genera 3-5 recomendaciones específicas y accionables
- Prioriza por urgencia e impacto
- Considera el contexto médico si aplica
- Las recomendaciones deben ser realistas y seguras`;

  return prompt.trim();
}

export function buildPersonalizedRecipePrompt(userProfile: UserProfile, mealType: string): string {
  // Procesar restricciones dietéticas si existen
  const dietaryRestrictions = userProfile.preferences?.dietaryRestrictions || [];
  const medicalConditions = userProfile.medicalConditions || [];
  
  // Fecha actual para contexto
  const fecha = new Date().toLocaleDateString('es-ES');
  
  // Categorías permitidas de comida
  const allowedCategories = ['desayuno', 'almuerzo', 'cena', 'merienda', 'snack'];

  const basePrompt = `Quiero que generes una receta saludable y original en formato JSON válido, sin explicaciones ni justificaciones. 
Debes usar la categoría de comida proporcionada: **${mealType}**.

Usa la siguiente estructura **estrictamente**:

{
  "name": "Nombre de la receta",
  "description": "Descripción breve de la receta",
  "category": "${mealType}",
  "ingredients": [
    {
      "name": "Nombre del ingrediente",
      "quantity": "Cantidad",
      "unit": "Unidad (g, ml, unidades, etc.)"
    }
  ],
  "steps": ["Paso 1", "Paso 2", "Paso 3", "..."],
  "nutritionalInfo": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fiber": 0
  },
  "prepTime": 0,
  "servings": 1
}

🧍 Datos del usuario:
- Edad: ${userProfile.age} años
- Altura: ${userProfile.height} cm
- Peso: ${userProfile.weight} kg
- Género: ${userProfile.gender}
- Nivel de actividad: ${userProfile.activityLevel}
- Objetivos fitness: ${userProfile.fitnessGoals?.length ? userProfile.fitnessGoals.join(', ') : 'general'}

✅ Restricciones dietéticas: ${dietaryRestrictions.length ? dietaryRestrictions.join(', ') : 'ninguna'}
🚫 Condiciones médicas: ${medicalConditions.length ? medicalConditions.join(', ') : 'ninguna'}

📅 Fecha de generación: ${fecha}

⚠️ IMPORTANTE:
- Responde **solo** con un objeto JSON válido.
- No incluyas explicaciones, comentarios, ni texto adicional.
- No uses backticks, markdown ni formato de código.
- La información nutricional debe ser aproximada pero realista.
- El tiempo de preparación debe estar en minutos.
- Adapta la receta al perfil nutricional del usuario.`;

  return basePrompt;
}