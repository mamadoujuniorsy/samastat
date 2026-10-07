import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // rawBody : nécessaire à la vérification de signature du webhook WhatsApp.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  new Logger('SamaStat').log(`API prête sur http://localhost:${port}`);
}
await bootstrap();
