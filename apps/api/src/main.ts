import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApplication } from './bootstrap/configure-application';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApplication(app);

  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3001);

  app.enableShutdownHooks();

  await app.listen(port);
}

void bootstrap();
