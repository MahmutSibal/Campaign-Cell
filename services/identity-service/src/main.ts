import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('IdentityServiceMain');
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
    .setTitle('CampaignCell - Identity Service')
    .setDescription('GSM+OTP Login, JWT Auth, Token Rotation, RBAC & Audit Logging Microservice')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.IDENTITY_SERVICE_PORT || process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Identity Service is running on port ${port}`);
  logger.log(`Swagger Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
