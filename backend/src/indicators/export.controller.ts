import { BadRequestException, Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
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

    if (fmt === 'xlsx' || fmt === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SamaStat';
      workbook.created = new Date(exportedAt);
      workbook.subject = 'Indicateurs ANSD cités par SamaStat';
      workbook.company = 'SamaStat';

      const metadata = workbook.addWorksheet('Lisez-moi');
      metadata.columns = [{ width: 24 }, { width: 110 }];
      metadata.addRows([
        ['Produit', 'SamaStat — export d’indicateurs ANSD'],
        ['Exporté le', exportedAt],
        ['Attribution', ATTRIBUTION],
        ['Nombre de lignes', records.length],
      ]);
      metadata.getColumn(1).font = { bold: true };
      metadata.getRow(3).getCell(2).alignment = { wrapText: true, vertical: 'top' };

      const sheet = workbook.addWorksheet('Indicateurs');
      sheet.columns = COLUMNS.map((column) => ({
        header: column,
        key: column,
        width: column === 'description' || column === 'source' || column === 'url' ? 42 : 18,
      }));
      sheet.addRows(records.map((record) => Object.fromEntries(COLUMNS.map((column) => [column, record[column] ?? '']))));
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNS.length)}${records.length + 1}` };
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '155E75' } };
      sheet.getRow(1).alignment = { vertical: 'middle' };
      sheet.getColumn('value').numFmt = '#,##0.00';
      sheet.eachRow((row) => {
        row.alignment = { vertical: 'top', wrapText: true };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      res
        .status(200)
        .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .setHeader('Content-Disposition', `attachment; filename="samastat-${stamp}.xlsx"`)
        .send(Buffer.from(buffer));
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="samastat-${stamp}.json"`)
      .send(JSON.stringify({ exportedAt, attribution: ATTRIBUTION, records }, null, 2));
  }
}
