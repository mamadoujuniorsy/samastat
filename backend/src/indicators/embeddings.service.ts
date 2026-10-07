import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createEmbedder, type Embedder } from './embedding.js';

/**
 * Charge le modèle d'embeddings une fois, en tâche de fond au démarrage.
 * Si le modèle n'est pas disponible (premier lancement hors ligne), la recherche
 * se replie sur le plein texte : le service reste utilisable.
 */
@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private embedder: Promise<Embedder | null> | null = null;
  /** Vrai une fois le modèle chargé avec succès. */
  loaded = false;

  onModuleInit(): void {
    void this.get();
  }

  get(): Promise<Embedder | null> {
    if (!this.embedder) {
      const started = Date.now();
      this.embedder = createEmbedder()
        .then((e) => {
          this.logger.log(`Modèle d'embeddings prêt (${e.model}) en ${Date.now() - started} ms`);
          this.loaded = true;
          return e;
        })
        .catch((err: Error) => {
          this.logger.warn(`Embeddings indisponibles, recherche plein texte seule : ${err.message}`);
          this.embedder = null; // nouvel essai au prochain appel
          return null;
        });
    }
    return this.embedder;
  }

  async embedQuery(text: string): Promise<number[] | null> {
    const e = await this.get();
    if (!e) return null;
    try {
      return await e.embedQuery(text);
    } catch (err) {
      this.logger.warn(`Échec d'embedding de la requête : ${(err as Error).message}`);
      return null;
    }
  }
}
