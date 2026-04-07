import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình CORS để cho phép Cookies
  app.enableCors({
    origin: true, // Trong thực tế nên để domain cụ thể
    credentials: true,
  });

  // Sử dụng cookie-parser để đọc cookie từ request
  app.use(cookieParser());

  // Global prefix cho tất cả các route
  app.setGlobalPrefix('api');

  // Áp dụng ZodValidationPipe toàn cục để tự động validate schema
  app.useGlobalPipes(new ZodValidationPipe());

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('NestJS ATS API')
    .setDescription('API documentation for the Applicant Tracking System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
  process.exit(1);
});
