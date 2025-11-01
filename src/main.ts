/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api/ai');

  // Enable CORS for LevelUp main project integration
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://localhost:8080',
    'https://level-up-ashy-sigma.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (como Postman, mobile apps, etc)
      if (!origin) return callback(null, true);
      
      // Verificar si el origin está en la lista permitida
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400, // 24 horas de cache para preflight
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('LevelUp AI Microservice')
    .setDescription('AI-powered fitness and nutrition microservice for LevelUp Gym App')
    .setVersion('1.0.0')
    .addTag('AI Main Service', 'Core AI orchestration endpoints')
    .addTag('Workout', 'Workout plan generation and management')
    .addTag('Diet', 'Diet plan generation and management')
    .addTag('Recommendations', 'Personalized recommendations and insights')
    .addServer('/api/ai', 'API Base URL')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/ai/docs', app, document, {
    customSiteTitle: 'LevelUp AI API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // Render usa PORT por defecto, fallback a AI_SERVICE_PORT o 3005
  const port = process.env.PORT || process.env.AI_SERVICE_PORT || 3005;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 LevelUp AI Microservice is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/ai/docs`);
  console.log(`🏥 Health Check: http://localhost:${port}/api/ai/health`);
}

bootstrap();
