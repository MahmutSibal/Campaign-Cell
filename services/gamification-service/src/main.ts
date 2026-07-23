import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('GamificationServiceMain');
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('CampaignCell - Gamification Service')
    .setDescription('Points, Badges, Levels, Leaderboard & Event-Driven Gamification Microservice')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.GAMIFICATION_SERVICE_PORT || process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`Gamification Service is running on port ${port}`);
  logger.log(`Swagger Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
