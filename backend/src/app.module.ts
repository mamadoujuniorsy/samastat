import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module.js';
import { IndicatorsModule } from './indicators/indicators.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { IndexingModule } from './indexing/indexing.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { SmsModule } from './sms/sms.module.js';
import { WolofModule } from './wolof/wolof.module.js';
import { AuthModule } from './auth/auth.module.js';
import { LlmModule } from './llm/llm.module.js';
import { TelegramModule } from './telegram/telegram.module.js';

@Module({
  imports: [
    // Le fichier .env vit à la racine du monorepo ; .env local du backend en repli.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    // Limite par adresse : 120 requêtes / minute par défaut, 30 / minute sur /ask (voir contrôleur).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    LlmModule,
    IndicatorsModule,
    AssistantModule,
    IndexingModule,
    WhatsappModule,
    SmsModule,
    WolofModule,
    TelegramModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
