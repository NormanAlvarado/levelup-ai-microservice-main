import {
  Controller,
  Post,
  Body,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FoodVisionService } from './food-vision.service';
import { createSuccessResponse, createErrorResponse } from '../shared/utils/api-response';

class AnalyzeFoodImageDto {
  imageBase64: string;
  mimeType?: string;
  mealType?: string;
}

@ApiTags('Food Vision')
@Controller('food-vision')
export class FoodVisionController {
  constructor(private readonly foodVisionService: FoodVisionService) {}

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyze food image with AI',
    description:
      'Upload a food image (base64 or file) and get AI-powered food detection with nutritional estimates',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Food image analyzed successfully',
    schema: {
      example: {
        success: true,
        data: {
          detectedFoods: [
            {
              name: 'Huevo revuelto',
              confidence: 95,
              estimatedGrams: 100,
            },
            {
              name: 'Tortilla de maíz',
              confidence: 90,
              estimatedGrams: 30,
            },
          ],
          totalEstimatedCalories: 250,
          totalEstimatedProtein: 15,
          totalEstimatedCarbs: 20,
          totalEstimatedFat: 12,
          suggestions: [
            'Excelente fuente de proteína',
            'Considera agregar vegetales para más fibra',
            'Buena opción para el desayuno',
          ],
        },
        message: 'Food image analyzed successfully',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  @ApiConsumes('application/json')
  @ApiBody({
    description: 'Food image data (base64 encoded)',
    schema: {
      type: 'object',
      required: ['imageBase64'],
      properties: {
        imageBase64: {
          type: 'string',
          description: 'Base64 encoded image (with or without data URI prefix)',
          example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        },
        mimeType: {
          type: 'string',
          description: 'MIME type of the image',
          example: 'image/jpeg',
          default: 'image/jpeg',
        },
        mealType: {
          type: 'string',
          description: 'Type of meal (breakfast, lunch, dinner, snack)',
          example: 'breakfast',
        },
      },
    },
  })
  async analyzeBase64Image(@Body() dto: AnalyzeFoodImageDto) {
    try {
      if (!dto.imageBase64) {
        throw new BadRequestException('imageBase64 is required');
      }

      // Validar formato base64
      if (!dto.imageBase64.includes('base64,') && !dto.imageBase64.match(/^[A-Za-z0-9+/=]+$/)) {
        throw new BadRequestException('Invalid base64 image format');
      }

      const result = await this.foodVisionService.analyzeFoodImage(
        dto.imageBase64,
        dto.mimeType || 'image/jpeg'
      );

      return createSuccessResponse(result, 'Food image analyzed successfully');
    } catch (error) {
      return createErrorResponse(error.message, error.stack);
    }
  }

  @Post('analyze-upload')
  @ApiOperation({
    summary: 'Analyze food image from file upload',
    description: 'Upload a food image file (jpg, png, jpeg, webp) and get AI-powered analysis',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Food image file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, png, jpeg, webp)',
        },
        mealType: {
          type: 'string',
          description: 'Type of meal',
          example: 'breakfast',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files (jpg, png, jpeg, webp) are allowed'), false);
        }
      },
    })
  )
  async analyzeUploadedImage(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      // Convertir buffer a base64
      const base64Image = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64Image}`;

      const result = await this.foodVisionService.analyzeFoodImage(dataUri, file.mimetype);

      return createSuccessResponse(
        {
          ...result,
          fileInfo: {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
        },
        'Food image analyzed successfully'
      );
    } catch (error) {
      return createErrorResponse(error.message, error.stack);
    }
  }
}
