import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cấu hình CORS để cho phép Cookies
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin?.split(',') || true,
    credentials: true,
  });

  // Tin tưởng Proxy để lấy đúng Client IP (quan trọng cho các cổng thanh toán)
  app.set('trust proxy', true);

  // Sử dụng cookie-parser để đọc cookie từ request
  app.use(cookieParser());

  // Global prefix cho tất cả các route
  app.setGlobalPrefix('api');

  // Áp dụng ZodValidationPipe toàn cục để tự động validate schema
  app.useGlobalPipes(new ZodValidationPipe());

  // Áp dụng Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Chuẩn hóa toàn bộ response thành { data, pagination?, ... }
  app.useGlobalInterceptors(new TransformInterceptor());

  // Áp dụng ClassSerializerInterceptor để @Exclude() hoạt động (bỏ password, v.v.)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Cấu hình Swagger (Chỉ bật trên môi trường dev, sẽ ẩn hoàn toàn trên production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NestJS ATS API')
      .setDescription('API documentation for the Applicant Tracking System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
  process.exit(1);
});
