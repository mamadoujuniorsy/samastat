import { BadRequestException, Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IndicatorsRepository } from './indicators.repository.js';
import type { Indicator } from './indicator.types.js';
import { toSdmxJson } from './sdmx.js';

const ATTRIBUTION =
  "Ce produit a été adapté à partir des informations de l'ANSD, sous licence conformément à l'Accord de licence de données ouvertes de l'ANSD (CC BY 4.0).";
const MAX_IDS = 50;

const COLUMNS: (keyof Indicator)[] = [
  'id', 'name', 'value', 'unit', 'territory', 'territory_level', 'period', 'source', 'platform', 'url', 'verified_at', 'description',
];

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export des enregistrements cités dans une réponse (Jalon 4). Les valeurs viennent de la base,
 * jamais d'un texte généré. Le fichier porte l'attribution exigée par la licence ANSD.
 */
@Controller('export')
export class ExportController {
  constructor(private readonly indicators: IndicatorsRepository) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async export(
    @Query('ids') idsParam: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const ids = (idsParam ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS);
    if (!ids.length) throw new BadRequestException('Paramètre ids manquant (identifiants séparés par des virgules).');

    const records = await this.indicators.getByIds(ids);
    const exportedAt = new Date().toISOString();
    const stamp = exportedAt.slice(0, 10);

    const fmt = (format ?? 'json').toLowerCase();

    if (fmt === 'sdmx' || fmt === 'sdmx-json') {
      res
        .status(200)
        .setHeader('Content-Type', 'application/vnd.sdmx.data+json; charset=utf-8; version=2.0.0')
        .setHeader('Content-Disposition', `attachment; filename="samastat-${stamp}.sdmx.json"`)
        .send(JSON.stringify(toSdmxJson(records, ATTRIBUTION), null, 2));
      return;
    }

    if (fmt === 'csv') {
      const lines = [
        `# SamaStat — export du ${exportedAt}`,
        `# ${ATTRIBUTION}`,
        COLUMNS.join(';'),
        ...records.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(';')),
      ];
      res
        .status(200)
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .setHeader('Content-Disposition', `attachment; filename="samastat-${stamp}.csv"`)
        .send(`﻿${lines.join('\r\n')}\r\n`);
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="samastat-${stamp}.json"`)
      .send(JSON.stringify({ exportedAt, attribution: ATTRIBUTION, records }, null, 2));
  }
}
