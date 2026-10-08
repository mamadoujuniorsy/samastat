import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Post, ServiceUnavailableException } from '@nestjs/common';
import { TelegramService } from './telegram.service.js';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegram: TelegramService) {}

  @Get('status')
  status() {
    return {
      enabled: this.telegram.enabled,
      webhookSecretConfigured: this.telegram.configuredWebhookSecret,
    };
  }

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Parameters<TelegramService['handleUpdate']>[0],
  ): Promise<{ received: true }> {
    if (!this.telegram.enabled) throw new ServiceUnavailableException('Canal Telegram non configuré.');
    if (!this.telegram.verifyWebhookSecret(secret)) throw new ForbiddenException('Secret webhook Telegram invalide.');
    void this.telegram.handleUpdate(update).catch((error: Error) => {
      this.logger.warn(`Traitement Telegram en échec : ${error.message}`);
    });
    return { received: true };
  }
}
