import { Controller, Post, Get, Body, Param, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse, ApiParam } from '@nestjs/swagger';
import { DietService } from './diet.service';
import { GenerateDietDto } from '../shared/dto/generate-diet.dto';
import { DietPlan } from '../shared/types/diet.interface';
import { ApiResponse } from '../shared/utils/api-response';

@ApiTags('Diet')
@Controller('diet')
export class DietController {
  constructor(private readonly dietService: DietService) {}

  @Post()
  @ApiOperation({
    summary: 'Generate personalized diet plan',
    description: 'Creates a personalized diet plan based on user preferences, goals, and dietary restrictions',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Diet plan generated successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid-456',
          name: 'Weight Loss Nutrition Plan',
          meals: [
            {
              name: 'Breakfast',
              items: [
                {
                  name: 'Oatmeal',
                  quantity: '1 cup',
                  calories: 300,
                  protein: 10,
                  carbs: 54,
                  fat: 6
                },
                {
                  name: 'Banana',
                  quantity: '1 medium',
                  calories: 105,
                  protein: 1,
                  carbs: 27,
                  fat: 0
                }
              ],
              totalCalories: 405,
              macros: {
                protein: 11,
                carbs: 81,
                fat: 6,
                fiber: 8
              }
            }
          ]
        },
        message: 'Diet plan generated successfully'
      }
    }
  })
  @SwaggerApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @SwaggerApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to generate diet plan',
  })
  async generateDiet(
    @Body(ValidationPipe) generateDietDto: GenerateDietDto,
  ): Promise<ApiResponse<DietPlan>> {
    return await this.dietService.generateDiet(generateDietDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get diet plan by ID',
    description: 'Retrieves a specific diet plan by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Diet plan ID',
    type: 'string',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Diet plan retrieved successfully',
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Diet plan not found',
  })
  async getDiet(@Param('id') id: string): Promise<ApiResponse<DietPlan>> {
    return await this.dietService.getDiet(id);
  }

  @Post(':id/regenerate')
  @ApiOperation({
    summary: 'Regenerate diet plan with modifications',
    description: 'Creates a new version of an existing diet plan with specified modifications',
  })
  @ApiParam({
    name: 'id',
    description: 'Existing diet plan ID',
    type: 'string',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Diet plan regenerated successfully',
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Original diet plan not found',
  })
  async regenerateDiet(
    @Param('id') id: string,
    @Body(ValidationPipe) modifications: Partial<GenerateDietDto>,
  ): Promise<ApiResponse<DietPlan>> {
    return await this.dietService.regenerateDiet(id, modifications);
  }

  @Post(':id/adjust-calories/:calories')
  @ApiOperation({
    summary: 'Adjust diet plan calories',
    description: 'Adjusts portion sizes in an existing diet plan to match new calorie target',
  })
  @ApiParam({
    name: 'id',
    description: 'Diet plan ID',
    type: 'string',
  })
  @ApiParam({
    name: 'calories',
    description: 'New calorie target',
    type: 'number',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Diet plan calories adjusted successfully',
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Diet plan not found',
  })
  async adjustCalories(
    @Param('id') id: string,
    @Param('calories') calories: string,
  ): Promise<ApiResponse<DietPlan>> {
    const newCalories = parseInt(calories, 10);
    if (isNaN(newCalories) || newCalories < 1000 || newCalories > 5000) {
      return {
        success: false,
        error: 'Invalid calories value. Must be between 1000 and 5000.',
      };
    }
    
    return await this.dietService.adjustCalories(id, newCalories);
  }

  @Post('personalized')
  @ApiOperation({
    summary: 'Generate personalized diet plan with user profile',
    description: 'Creates a highly personalized diet plan using the user profile data from database, including medical conditions, preferences, and activity level',
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Personalized diet plan generated successfully',
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User profile not found',
  })
  @SwaggerApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to generate personalized diet plan',
  })
  async generatePersonalizedDiet(
    @Body(ValidationPipe) generateDietDto: GenerateDietDto,
  ): Promise<ApiResponse<DietPlan>> {
    return await this.dietService.generatePersonalizedDiet(generateDietDto);
  }

  @Post('recipe/user/:userId/:mealType')
  @ApiOperation({
    summary: 'Generate personalized recipe',
    description: 'Generates a personalized recipe based on user profile, dietary preferences, and meal type (like the reference project)',
  })
  @ApiParam({ 
    name: 'userId', 
    description: 'ID del usuario', 
    type: String 
  })
  @ApiParam({ 
    name: 'mealType', 
    description: 'Tipo de comida (desayuno, almuerzo, cena, merienda)', 
    enum: ['desayuno', 'almuerzo', 'cena', 'merienda'] 
  })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Personalized recipe generated successfully',
    schema: {
      example: {
        success: true,
        data: {
          name: 'Avena con Frutas Proteica',
          description: 'Desayuno balanceado alto en proteína y fibra',
          category: 'desayuno',
          ingredients: [
            {
              name: 'Avena',
              quantity: '1',
              unit: 'taza'
            },
            {
              name: 'Leche descremada',
              quantity: '200',
              unit: 'ml'
            }
          ],
          steps: [
            'Cocinar la avena con leche a fuego lento',
            'Agregar las frutas y nueces'
          ],
          nutritionalInfo: {
            calories: 350,
            protein: 15,
            carbs: 45,
            fat: 8,
            fiber: 6
          },
          prepTime: 10,
          servings: 1,
          userId: 'user-123',
          createdAt: '2024-01-01T10:00:00Z'
        },
        message: 'Receta personalizada generada exitosamente'
      }
    }
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User profile not found',
  })
  @SwaggerApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Failed to generate personalized recipe',
  })
  async generatePersonalizedRecipe(
    @Param('userId') userId: string,
    @Param('mealType') mealType: 'desayuno' | 'almuerzo' | 'cena' | 'merienda'
  ) {
    return this.dietService.generatePersonalizedRecipe(userId, mealType);
  }
}