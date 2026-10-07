/** Une ligne de la table `indicators` : la seule origine possible d'une valeur affichée. */
export interface Indicator {
  id: string;
  name: string;
  description: string | null;
  value: number;
  unit: string;
  territory: string;
  territory_level: string;
  period: string;
  source: string;
  platform: string;
  url: string;
  keywords: string[];
  domain: string;
  verified_at: string | null;
}

export interface BrowseFilters {
  domain?: string;
  level?: string;
  q?: string;
}

/**
 * Résumé renvoyé au modèle lors d'une recherche. Il ne contient PAS la valeur :
 * le modèle doit explicitement la demander via l'outil de récupération.
 */
export interface IndicatorSummary {
  id: string;
  name: string;
  territory: string;
  territory_level: string;
  period: string;
  unit: string;
  /** Score de pertinence (0-1) de la recherche hybride ; absent pour un simple listage. */
  score?: number;
}

export interface SearchFilters {
  territory?: string;
  period?: string;
}
