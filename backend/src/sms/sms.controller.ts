import { Body, Controller, HttpCode, Logger, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SmsService } from './sms.service.js';

/** Forme du webhook entrant Africa's Talking (formulaire) : from, to, text, date, id, linkId. */
interface InboundSms {
  from?: string;
  to?: string;
  text?: string;
  id?: string;
}

@ApiTags('Canaux')
@Controller('sms')
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(private readonly sms: SmsService) {}

  /** Réception d'un SMS : répond 200 immédiatement, traite en arrière-plan. */
  @Post('inbound')
  @HttpCode(200)
  @ApiOperation({ summary: "Webhook SMS entrant (Africa's Talking) : question par SMS, réponse par SMS" })
  receive(@Body() body: InboundSms): { received: true } {
    if (!this.sms.enabled) throw new ServiceUnavailableException('Canal SMS non configuré.');
    const from = body?.from?.trim();
    const text = body?.text?.trim().slice(0, 500);
    if (!from || !text || text.length < 2) return { received: true };
    void this.sms.handleIncoming(from, text).catch((err: Error) => this.logger.warn(`Traitement SMS en échec : ${err.message}`));
    return { received: true };
  }
}
