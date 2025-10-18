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
  "description": "Descripción detallada del plan",
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

INSTRUCCIONES:
${prompt}

IMPORTANTE: 
- Responde ÚNICAMENTE con el JSON válido
- NO agregues texto antes o después del JSON
- NO uses markdown, backticks ni formato de código
- Asegúrate que sea JSON válido y completo
- Incluye entre 4-8 ejercicios apropiados
- Los valores numéricos deben ser números, no strings
- Las instrucciones deben ser claras y seguras`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
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
        
        // Validar estructura requerida
        if (!workoutData.name || !workoutData.description || !Array.isArray(workoutData.exercises)) {
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
                    text: `Eres un nutricionista experto. Genera un plan nutricional personalizado en formato JSON válido.
                    El JSON debe tener la estructura exacta: {
                      "name": "string",
                      "description": "string",
                      "meals": [
                        {
                          "name": "string",
                          "items": [
                            {
                              "name": "string",
                              "quantity": "string",
                              "calories": number,
                              "protein": number,
                              "carbs": number,
                              "fat": number
                            }
                          ],
                          "totalCalories": number,
                          "macros": {
                            "protein": number,
                            "carbs": number,
                            "fat": number,
                            "fiber": number
                          },
                          "instructions": "string (opcional)",
                          "prepTime": number
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
              temperature: 0.7,
              maxOutputTokens: 1000,
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
        const dietData = JSON.parse(jsonString);
        
        // Validar estructura requerida
        if (!dietData.name || !dietData.description || !Array.isArray(dietData.meals)) {
          throw new BadRequestException('El plan dietético generado no contiene los campos requeridos');
        }

        return dietData;
      } catch (parseError) {
        this.logger.error('Error parsing diet JSON:', parseError);
        throw new BadRequestException('No se pudo parsear el plan dietético generado por IA');
      }

    } catch (error) {
      this.logger.error('Error generating diet plan with Gemini:', error?.response?.data || error);
      throw new InternalServerErrorException('Error al generar plan dietético con IA');
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