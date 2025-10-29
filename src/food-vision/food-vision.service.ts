import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export interface FoodAnalysisResult {
  detectedFoods: Array<{
    name: string;
    confidence: number;
    estimatedGrams: number;
  }>;
  totalEstimatedCalories: number;
  totalEstimatedProtein: number;
  totalEstimatedCarbs: number;
  totalEstimatedFat: number;
  suggestions: string[];
  rawAnalysis: string;
}

@Injectable()
export class FoodVisionService {
  private readonly logger = new Logger(FoodVisionService.name);
  private gemini: GoogleGenerativeAI | null = null;
  private openai: OpenAI | null = null;
  private defaultProvider: string;

  constructor(private configService: ConfigService) {
    const geminiKey = this.configService.get<string>('gemini.apiKey');
    const openaiKey = this.configService.get<string>('openai.apiKey');
    this.defaultProvider = this.configService.get<string>('ai.defaultProvider') || 'gemini';

    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
      this.logger.log('Gemini Vision initialized');
    }

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.logger.log('OpenAI Vision initialized');
    }

    if (!this.gemini && !this.openai) {
      this.logger.warn('No AI vision providers configured');
    }
  }

  /**
   * Analiza una imagen de comida usando IA
   * Soporta: Gemini Vision (preferido) u OpenAI Vision
   */
  async analyzeFoodImage(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<FoodAnalysisResult> {
    this.logger.log('Starting food image analysis');

    try {
      // Intentar con el proveedor predeterminado primero
      if (this.defaultProvider === 'gemini' && this.gemini) {
        return await this.analyzeWithGemini(imageBase64, mimeType);
      } else if (this.defaultProvider === 'openai' && this.openai) {
        return await this.analyzeWithOpenAI(imageBase64, mimeType);
      }

      // Fallback al otro proveedor disponible
      if (this.gemini) {
        return await this.analyzeWithGemini(imageBase64, mimeType);
      } else if (this.openai) {
        return await this.analyzeWithOpenAI(imageBase64, mimeType);
      }

      throw new Error('No AI vision providers available');
    } catch (error) {
      this.logger.error('Error analyzing food image:', error);
      throw error;
    }
  }

  /**
   * Analiza imagen con Gemini Vision
   */
  private async analyzeWithGemini(
    imageBase64: string,
    mimeType: string
  ): Promise<FoodAnalysisResult> {
    if (!this.gemini) {
      throw new Error('Gemini API key no está configurada');
    }

    this.logger.log('Using Gemini Vision for analysis');

    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Eres un experto nutricionista. Analiza esta imagen de comida y proporciona:

1. Lista de TODOS los alimentos que identificas (nombre, confianza del 0-100%, gramos estimados)
2. Información nutricional TOTAL estimada (calorías, proteínas, carbohidratos, grasas)
3. Sugerencias nutricionales (máximo 3)

IMPORTANTE:
- Si ves múltiples alimentos (ej: 2 huevos, 1 tortilla), enuméralos TODOS por separado
- Sé preciso con las cantidades en gramos
- Si no estás seguro, indica la confianza baja

Responde SOLO en formato JSON sin markdown:
{
  "detectedFoods": [
    {"name": "string", "confidence": number, "estimatedGrams": number}
  ],
  "totalEstimatedCalories": number,
  "totalEstimatedProtein": number,
  "totalEstimatedCarbs": number,
  "totalEstimatedFat": number,
  "suggestions": ["string"]
}`;

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
            mimeType,
          },
        },
        { text: prompt },
      ]);

      const response = await result.response;
      const text = response.text();

      this.logger.log('Gemini raw response:', text);

      // Limpiar y parsear respuesta
      const cleanedText = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsedResult = JSON.parse(cleanedText);

      return {
        ...parsedResult,
        rawAnalysis: text,
      };
    } catch (error) {
      this.logger.error('Gemini analysis error:', error);
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
  }

  /**
   * Analiza imagen con OpenAI Vision (GPT-4 Vision)
   */
  private async analyzeWithOpenAI(
    imageBase64: string,
    mimeType: string
  ): Promise<FoodAnalysisResult> {
    this.logger.log('Using OpenAI Vision for analysis');

    const prompt = `Eres un experto nutricionista. Analiza esta imagen de comida y proporciona:

1. Lista de TODOS los alimentos que identificas (nombre, confianza del 0-100%, gramos estimados)
2. Información nutricional TOTAL estimada (calorías, proteínas, carbohidratos, grasas)
3. Sugerencias nutricionales (máximo 3)

IMPORTANTE:
- Si ves múltiples alimentos (ej: 2 huevos, 1 tortilla), enuméralos TODOS por separado
- Sé preciso con las cantidades en gramos
- Si no estás seguro, indica la confianza baja

Responde SOLO en formato JSON sin markdown:
{
  "detectedFoods": [
    {"name": "string", "confidence": number, "estimatedGrams": number}
  ],
  "totalEstimatedCalories": number,
  "totalEstimatedProtein": number,
  "totalEstimatedCarbs": number,
  "totalEstimatedFat": number,
  "suggestions": ["string"]
}`;

    try {
      // Verificar que OpenAI está configurado
      if (!this.openai) {
        throw new Error('OpenAI API key no está configurada');
      }

      // Asegurar que el base64 tiene el formato correcto
      let imageUrl = imageBase64;
      if (!imageUrl.startsWith('data:')) {
        imageUrl = `data:${mimeType};base64,${imageBase64}`;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const text = response.choices[0]?.message?.content || '';
      this.logger.log('OpenAI raw response:', text);

      // Limpiar y parsear respuesta
      const cleanedText = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsedResult = JSON.parse(cleanedText);

      return {
        ...parsedResult,
        rawAnalysis: text,
      };
    } catch (error) {
      this.logger.error('OpenAI analysis error:', error);
      throw new Error(`OpenAI analysis failed: ${error.message}`);
    }
  }
}
