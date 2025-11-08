import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GenerateWorkoutDto } from '../shared/dto/generate-workout.dto';
import { GenerateDietDto } from '../shared/dto/generate-diet.dto';
import { RecommendationDto } from '../shared/dto/recommendation.dto';
import { UserProfile } from '../shared/types/user.interface';
import { 
  buildWorkoutPrompt, 
  buildDietPrompt, 
  buildRecommendationPrompt,
  buildPersonalizedRecipePrompt 
} from '../shared/utils/prompt-builder';

@Injectable()
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.apiKey = this.configService.get<string>('gemini.apiKey') || '';
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }
  }

  async generateWorkoutPlan(dto: GenerateWorkoutDto, userProfile?: UserProfile): Promise<any> {
    try {
      const prompt = buildWorkoutPrompt(dto, userProfile);
      
      const { data } = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            contents: [
              {
                parts: [
                  {
                    text: `Eres un entrenador personal experto. Genera ÚNICAMENTE un JSON válido con un plan de entrenamiento personalizado.

FORMATO REQUERIDO (copiar estructura exacta):
{
  "name": "Nombre del plan de entrenamiento",
  "description": "Descripción breve del plan",
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
          "instructions": "Instrucciones breves",
          "targetMuscles": ["músculo1", "músculo2"]
        }
      ]
    }
  ]
}

INSTRUCCIONES:
${prompt}

IMPORTANTE: 
- Responde ÚNICAMENTE con el JSON válido
- NO agregues texto antes o después del JSON
- NO uses markdown, backticks ni formato de código
- Asegúrate que sea JSON válido y COMPLETO (cierra todos los arrays y objetos)
- Cada día debe tener 4-6 ejercicios máximo
- Las instrucciones deben ser breves (máximo 2 líneas)
- Cierra TODOS los objetos y arrays correctamente`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            }
          },
          {
            params: { key: this.apiKey },
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );

      // Log completo de la respuesta de Gemini INMEDIATAMENTE
      console.log('=== FULL GEMINI API RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      console.log('=== END FULL RESPONSE ===');

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      // Log del contenido para debugging INMEDIATAMENTE
      console.log('=== RAW GEMINI CONTENT ===');
      console.log(content);
      console.log('=== END GEMINI CONTENT ===');
      
      if (!content) {
        throw new InternalServerErrorException('No se recibió respuesta de Gemini AI');
      }

      // Extraer JSON de la respuesta - limpieza más robusta
      let jsonString = content;
      
      // Eliminar markdown y texto extra
      jsonString = jsonString
        .replace(/```json\s*/gi, '')  // Remover ```json
        .replace(/```\s*/g, '')       // Remover ```
        .replace(/^[^{]*/, '')        // Remover texto antes del primer {
        .replace(/[^}]*$/, '')        // Remover texto después del último }
        .trim();
      
      // Si no encontramos JSON, buscar entre llaves
      if (!jsonString.startsWith('{')) {
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        
        if (start === -1 || end === -1) {
          console.log('ERROR: No JSON found in content:', content);
          throw new BadRequestException('No se encontró un bloque JSON válido en la respuesta de IA');
        }
        
        jsonString = content.substring(start, end + 1).trim();
      }

      console.log('=== EXTRACTED JSON ===');
      console.log(jsonString);
      console.log('=== END EXTRACTED JSON ===');
      
      try {
        // Intentar múltiples estrategias de parsing
        let workoutData;
        
        try {
          workoutData = JSON.parse(jsonString);
        } catch (firstError) {
          console.log('First JSON parse failed:', firstError.message);
          
          // Intentar limpiar el JSON - estrategias más agresivas
          let cleanedJson = jsonString
            .replace(/,\s*([}\]])/g, '$1')     // Remover comas trailing
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Comillas en keys
            .replace(/:\s*([^",\[\]{}0-9][^,}\]]*)/g, (match, value) => {
              // Agregar comillas a strings no entrecomillados
              return ': "' + value.trim() + '"';
            })
            .replace(/"\s*(\d+)\s*"/g, '$1')   // Remover comillas de números
            .replace(/,(\s*[}\]])/g, '$1');    // Limpiar comas extra
          
          console.log('=== CLEANED JSON ATTEMPT ===');
          console.log(cleanedJson);
          console.log('=== END CLEANED JSON ===');
          
          try {
            workoutData = JSON.parse(cleanedJson);
          } catch (secondError) {
            console.log('Both JSON parsing attempts failed');
            console.log('Original JSON:', jsonString);
            console.log('Cleaned JSON:', cleanedJson);
            console.log('Second Error:', secondError.message);
            
            // Última estrategia: crear un JSON básico de fallback
            workoutData = {
              name: "Plan de Entrenamiento Básico",
              description: "Plan generado automáticamente",
              exercises: [
                {
                  name: "Sentadillas",
                  sets: 3,
                  reps: "8-12",
                  restTime: "2-3 min",
                  instructions: "Ejercicio básico para piernas",
                  targetMuscles: ["cuádriceps", "glúteos"]
                }
              ]
            };
            console.log('Using fallback workout data');
          }
        }
        
        // Validar estructura requerida - soportar ambos formatos (legacy y nuevo)
        const hasLegacyFormat = workoutData.exercises && Array.isArray(workoutData.exercises);
        const hasNewFormat = workoutData.days && Array.isArray(workoutData.days);
        
        if (!workoutData.name || !workoutData.description || (!hasLegacyFormat && !hasNewFormat)) {
          throw new BadRequestException('El plan de entrenamiento generado no contiene los campos requeridos');
        }

        return workoutData;
      } catch (parseError) {
        this.logger.error('Error parsing workout JSON:', parseError);
        this.logger.error('JSON string that failed:', jsonString);
        throw new BadRequestException('No se pudo parsear el plan de entrenamiento generado por IA');
      }

    } catch (error) {
      this.logger.error('Error generating workout plan with Gemini:', error?.response?.data || error);
      throw new InternalServerErrorException('Error al generar plan de entrenamiento con IA');
    }
  }

  async generateDietPlan(dto: GenerateDietDto, userProfile?: UserProfile): Promise<any> {
    try {
      const prompt = buildDietPrompt(dto, userProfile);
      
      const { data } = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            contents: [
              {
                parts: [
                  {
                    text: `Eres un nutricionista experto. Genera un plan nutricional SEMANAL COMPLETO (7 DÍAS) en formato JSON.

IMPORTANTE: Responde SOLO con JSON válido, sin markdown, sin explicaciones, sin \`\`\`json.

Estructura JSON requerida - Debes generar comidas para TODA LA SEMANA:
{
  "name": "Nombre del Plan (string)",
  "description": "Descripción breve (string)",
  "meals": [
    // COMIDAS DEL LUNES (${dto.mealsPerDay || 4} comidas)
    {
      "name": "Desayuno - Lunes",
      "items": [
        {
          "name": "Nombre del alimento",
          "quantity": "Cantidad con unidad (ej: 100g, 1 taza)",
          "calories": 0,
          "protein": 0,
          "carbs": 0,
          "fat": 0,
          "fiber": 0
        }
      ],
      "totalCalories": 0,
      "macros": { "protein": 0, "carbs": 0, "fat": 0, "fiber": 0 },
      "instructions": "Instrucciones de preparación",
      "prepTime": 0
    },
    // ... más comidas del Lunes (Media Mañana, Almuerzo, Merienda, Cena)
    
    // COMIDAS DEL MARTES (${dto.mealsPerDay || 4} comidas DIFERENTES)
    {
      "name": "Desayuno - Martes",
      "items": [ /* INGREDIENTES DIFERENTES AL LUNES */ ],
      // ...
    },
    // ... continúa con Miércoles, Jueves, Viernes, Sábado, Domingo
    
    // TOTAL: ${(dto.mealsPerDay || 4) * 7} comidas en el array
  ]
}

REGLAS CRÍTICAS:
1. El array "meals" debe tener EXACTAMENTE ${(dto.mealsPerDay || 4) * 7} elementos (${dto.mealsPerDay || 4} comidas × 7 días)
2. Nombra cada comida indicando el día: "Desayuno - Lunes", "Almuerzo - Martes", etc.
3. VARÍA LOS INGREDIENTES: No repitas la misma proteína principal más de 2 veces en la semana
4. Alterna carbohidratos: arroz, quinoa, pasta, avena, batata, etc.
5. Usa diferentes verduras y frutas cada día

${prompt}

RECUERDA: 
- Solo JSON válido, sin ningún texto extra
- Genera TODAS las comidas de los 7 días (${(dto.mealsPerDay || 4) * 7} comidas totales)
- VARIEDAD es esencial: cada día debe tener comidas DIFERENTES`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8000, // Aumentado para planes semanales completos (35 comidas)
              topP: 0.95,
              topK: 40,
            }
          },
          {
            params: { key: this.apiKey },
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!content) {
        throw new InternalServerErrorException('No se recibió respuesta de Gemini AI');
      }

      // Limpiar la respuesta de posibles marcadores de código
      let cleanContent = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      // Extraer JSON de la respuesta
      const start = cleanContent.indexOf('{');
      const end = cleanContent.lastIndexOf('}');
      
      if (start === -1 || end === -1) {
        this.logger.error('No se encontró JSON en la respuesta:', cleanContent.substring(0, 200));
        throw new BadRequestException('No se encontró un bloque JSON válido en la respuesta de IA');
      }

      const jsonString = cleanContent.substring(start, end + 1).trim();
      
      try {
        const dietData = JSON.parse(jsonString);
        
        // Validar estructura requerida
        if (!dietData.name || !dietData.description || !Array.isArray(dietData.meals)) {
          this.logger.error('Estructura inválida:', dietData);
          throw new BadRequestException('El plan dietético generado no contiene los campos requeridos');
        }

        return dietData;
      } catch (parseError) {
        this.logger.error('Error parsing diet JSON:');
        this.logger.error(parseError);
        this.logger.error('JSON String (primeros 500 chars):', jsonString.substring(0, 500));
        
        // Intentar reparar JSON común
        try {
          // Remover comas finales antes de ] o }
          const repairedJson = jsonString
            .replace(/,(\s*[}\]])/g, '$1')
            // Remover saltos de línea dentro de strings
            .replace(/"\s*\n\s*"/g, '" "')
            // Remover caracteres de control
            .replace(/[\x00-\x1F\x7F]/g, '');
          
          const dietData = JSON.parse(repairedJson);
          
          if (!dietData.name || !dietData.description || !Array.isArray(dietData.meals)) {
            throw new BadRequestException('El plan dietético generado no contiene los campos requeridos');
          }
          
          this.logger.log('JSON reparado exitosamente');
          return dietData;
        } catch (repairError) {
          this.logger.error('No se pudo reparar el JSON');
          throw new BadRequestException('No se pudo parsear el plan dietético generado por IA');
        }
      }

    } catch (error) {
      this.logger.error('Error generating diet plan with Gemini:');
      this.logger.error('Error type:', error?.constructor?.name);
      this.logger.error('Error message:', error?.message);
      this.logger.error('Error response:', error?.response?.data);
      this.logger.error('Error status:', error?.response?.status);
      this.logger.error('Full error:', error);
      
      // Verificar si es un error de rate limit
      if (error?.response?.status === 429) {
        throw new InternalServerErrorException('Límite de requests excedido. Por favor espera un momento e intenta de nuevo.');
      }
      
      // Verificar si es un error de API key
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        throw new InternalServerErrorException('Error de autenticación con la API de Gemini. Verifica la configuración.');
      }
      
      throw new InternalServerErrorException(`Error al generar plan dietético con IA: ${error?.message || 'Error desconocido'}`);
    }
  }

  async generateRecommendations(dto: RecommendationDto, userProfile?: UserProfile): Promise<any> {
    try {
      const prompt = buildRecommendationPrompt(dto, userProfile);
      
      const { data } = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            contents: [
              {
                parts: [
                  {
                    text: `Eres un coach de fitness y nutrición experto. Genera recomendaciones personalizadas basadas en el progreso del usuario en formato JSON válido.
                    El JSON debe tener la estructura exacta: {
                      "recommendations": [
                        {
                          "type": "workout_adjustment|diet_modification|rest_recommendation|goal_suggestion|motivational",
                          "title": "string",
                          "description": "string",
                          "priority": "low|medium|high|critical",
                          "category": "fitness|nutrition|recovery|motivation|health",
                          "actionable": boolean,
                          "metadata": object
                        }
                      ]
                    }
                    
                    ${prompt}
                    
                    Responde SOLO con el JSON válido, sin texto adicional ni markdown.`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 800,
            }
          },
          {
            params: { key: this.apiKey },
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!content) {
        throw new InternalServerErrorException('No se recibió respuesta de Gemini AI');
      }

      // Extraer JSON de la respuesta
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      
      if (start === -1 || end === -1) {
        throw new BadRequestException('No se encontró un bloque JSON válido en la respuesta de IA');
      }

      const jsonString = content.substring(start, end + 1).trim();
      
      try {
        const recommendationsData = JSON.parse(jsonString);
        
        // Validar estructura requerida
        if (!recommendationsData.recommendations || !Array.isArray(recommendationsData.recommendations)) {
          throw new BadRequestException('Las recomendaciones generadas no contienen los campos requeridos');
        }

        return recommendationsData;
      } catch (parseError) {
        this.logger.error('Error parsing recommendations JSON:', parseError);
        throw new BadRequestException('No se pudo parsear las recomendaciones generadas por IA');
      }

    } catch (error) {
      this.logger.error('Error generating recommendations with Gemini:', error?.response?.data || error);
      throw new InternalServerErrorException('Error al generar recomendaciones con IA');
    }
  }

  // Método adicional para generar recetas personalizadas
  async generatePersonalizedRecipe(userProfile: UserProfile, mealType: string): Promise<any> {
    try {
      const prompt = buildPersonalizedRecipePrompt(userProfile, mealType);
      
      const { data } = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          {
            contents: [
              {
                parts: [
                  {
                    text: `Eres un chef nutricionista experto. Genera ÚNICAMENTE un JSON válido con una receta personalizada.

FORMATO REQUERIDO (copiar estructura exacta):
{
  "name": "Nombre de la receta",
  "description": "Descripción de la receta",
  "category": "categoría de comida",
  "ingredients": [
    {
      "name": "Nombre del ingrediente",
      "quantity": "cantidad",
      "unit": "unidad"
    }
  ],
  "steps": ["Paso 1", "Paso 2"],
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

INSTRUCCIONES:
${prompt}

IMPORTANTE: 
- Responde ÚNICAMENTE con el JSON válido
- NO agregues texto antes o después del JSON
- NO uses markdown, backticks ni formato de código
- Asegúrate que sea JSON válido y completo
- Los valores numéricos deben ser números, no strings`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1200,
            }
          },
          {
            params: { key: this.apiKey },
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );

      // Log completo de la respuesta de Gemini para debugging
      console.log('=== FULL GEMINI RECIPE RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      console.log('=== END FULL RECIPE RESPONSE ===');

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      // Log del contenido para debugging
      console.log('=== RAW GEMINI RECIPE CONTENT ===');
      console.log(content);
      console.log('=== END GEMINI RECIPE CONTENT ===');
      
      if (!content) {
        throw new InternalServerErrorException('No se recibió respuesta de Gemini AI');
      }

      // Extraer JSON de la respuesta - limpieza más robusta
      let jsonString = content;
      
      // Eliminar markdown y texto extra
      jsonString = jsonString
        .replace(/```json\s*/gi, '')  // Remover ```json
        .replace(/```\s*/g, '')       // Remover ```
        .replace(/^[^{]*/, '')        // Remover texto antes del primer {
        .replace(/[^}]*$/, '')        // Remover texto después del último }
        .trim();
      
      // Si no encontramos JSON, buscar entre llaves
      if (!jsonString.startsWith('{')) {
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        
        if (start === -1 || end === -1) {
          console.log('ERROR: No JSON found in recipe content:', content);
          throw new BadRequestException('No se encontró un bloque JSON válido en la respuesta de IA');
        }
        
        jsonString = content.substring(start, end + 1).trim();
      }

      console.log('=== EXTRACTED RECIPE JSON ===');
      console.log(jsonString);
      console.log('=== END EXTRACTED RECIPE JSON ===');
      
      try {
        // Intentar múltiples estrategias de parsing
        let recipeData;
        
        try {
          recipeData = JSON.parse(jsonString);
        } catch (firstError) {
          console.log('First recipe JSON parse failed:', firstError.message);
          
          // Intentar limpiar el JSON - estrategias más agresivas
          let cleanedJson = jsonString
            .replace(/,\s*([}\]])/g, '$1')     // Remover comas trailing
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Comillas en keys
            .replace(/:\s*([^",\[\]{}0-9][^,}\]]*)/g, (match, value) => {
              // Agregar comillas a strings no entrecomillados
              return ': "' + value.trim() + '"';
            })
            .replace(/"\s*(\d+)\s*"/g, '$1')   // Remover comillas de números
            .replace(/,(\s*[}\]])/g, '$1');    // Limpiar comas extra
          
          console.log('=== CLEANED RECIPE JSON ATTEMPT ===');
          console.log(cleanedJson);
          console.log('=== END CLEANED RECIPE JSON ===');
          
          try {
            recipeData = JSON.parse(cleanedJson);
          } catch (secondError) {
            console.log('Both recipe JSON parsing attempts failed');
            console.log('Original JSON:', jsonString);
            console.log('Cleaned JSON:', cleanedJson);
            console.log('Second Error:', secondError.message);
            
            // Última estrategia: crear una receta básica de fallback
            recipeData = {
              name: "Receta Saludable Básica",
              description: "Receta generada automáticamente",
              category: mealType || "desayuno",
              ingredients: [
                {
                  name: "Avena",
                  quantity: "1/2",
                  unit: "taza"
                }
              ],
              steps: ["Preparar los ingredientes", "Mezclar todo", "Servir"],
              nutritionalInfo: {
                calories: 200,
                protein: 8,
                carbs: 30,
                fat: 4,
                fiber: 5
              },
              prepTime: 10,
              servings: 1
            };
            console.log('Using fallback recipe data');
          }
        }
        
        // Validar estructura requerida
        if (!recipeData.name || !recipeData.description || 
            !Array.isArray(recipeData.ingredients) || 
            !Array.isArray(recipeData.steps) || 
            !recipeData.category) {
          throw new BadRequestException('La receta generada no contiene los campos requeridos');
        }

        return recipeData;
      } catch (parseError) {
        this.logger.error('Error parsing recipe JSON:', parseError);
        this.logger.error('JSON string that failed:', jsonString);
        throw new BadRequestException('No se pudo parsear la receta generada por IA');
      }

    } catch (error) {
      this.logger.error('Error generating personalized recipe with Gemini:', error?.response?.data || error);
      throw new InternalServerErrorException('Error al generar receta personalizada con IA');
    }
  }

}