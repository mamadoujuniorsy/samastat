import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

/**
 * Tests de bout en bout : nécessitent la base PostgreSQL (npm run db:up && npm run db:migrate && npm run db:seed).
 * Aucun appel au modèle n'est effectué : ANTHROPIC_API_KEY est vidée pour vérifier le chemin « non configuré »,
 * et les services wolof (modèles lourds) sont désactivés.
 */
describe('API SamaStat (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = '';
    process.env.GROQ_API_KEY = '';
    process.env.SAMASTAT_FALLBACK_API_KEY = '';
    process.env.SAMASTAT_WOLOF_TRANSLATION = '0';
    process.env.SAMASTAT_WOLOF_TTS = '0';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 120_000);

  it('GET /health renvoie le nombre d’indicateurs et d’études', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.indicators).toBeGreaterThan(0);
    expect(res.body.surveys).toBeGreaterThan(0);
  });

  it('GET /indicators renvoie des résumés sans valeur', async () => {
    const res = await request(app.getHttpServer()).get('/indicators').expect(200);
    expect(res.body.indicators.length).toBeGreaterThan(0);
    expect(res.body.indicators[0]).not.toHaveProperty('value');
  });

  it('GET /indicators/:id renvoie la fiche avec séries et citation', async () => {
    const res = await request(app.getHttpServer()).get('/indicators/rgph5-2023-population-region-dakar').expect(200);
    expect(res.body.record.formattedValue).toContain('habitants');
    expect(res.body.byTerritory.length).toBeGreaterThan(5);
    expect(res.body.citation).toContain('ANSD');
  });

  it('GET /export?format=sdmx renvoie un message SDMX-JSON', async () => {
    const res = await request(app.getHttpServer())
      .get('/export?ids=ihpc-2023-inflation-senegal,ihpc-2024-inflation-senegal&format=sdmx')
      .expect(200);
    expect(res.headers['content-type']).toContain('sdmx');
    expect(res.body.data.dataSets[0].series['0:0'].observations['0'][0]).toBe(5.9);
  });

  it('GET /wolof/status indique les services inactifs en test', async () => {
    const res = await request(app.getHttpServer()).get('/wolof/status').expect(200);
    expect(res.body.translation.enabled).toBe(false);
    expect(res.body.tts.enabled).toBe(false);
  });

  it('POST /ask refuse une question vide', async () => {
    await request(app.getHttpServer()).post('/ask').send({ question: ' ' }).expect(400);
  });

  it('POST /ask répond « non configuré » sans clé API, sans inventer de donnée', async () => {
    const res = await request(app.getHttpServer())
      .post('/ask')
      .send({ question: 'Quelle est la population de Dakar ?' })
      .expect(201);
    expect(res.body.status).toBe('error');
    expect(res.body.data).toEqual([]);
    expect(res.body.answer).not.toMatch(/\d/);
  });

  it('POST /ask/stream émet des événements SSE puis une erreur sans clé API', async () => {
    const res = await request(app.getHttpServer())
      .post('/ask/stream')
      .send({ question: 'Quelle est la population de Dakar ?' })
      .expect(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: step');
    expect(res.text).toContain('event: error');
  });

  afterAll(async () => {
    await app.close();
  });
});
