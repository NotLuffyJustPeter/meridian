import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3001);

  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(port);
}

void bootstrap();
