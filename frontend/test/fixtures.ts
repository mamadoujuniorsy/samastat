import type { AskResponse } from "@/lib/types";

export const response: AskResponse = {
  status: "answered", question: "Population du Sénégal ?", answer: "La population est de 18 032 473 habitants.",
  answerWolof: null, suggestions: [], surveys: [], chart: null, followUps: [],
  data: [{
    indicatorId: "pop-sen-2023", name: "Population", value: 18032473, formattedValue: "18 032 473 habitants",
    unit: "habitants", territory: "Sénégal", territoryLevel: "national", period: "2023",
    source: "RGPH-5", platform: "ANSD", url: "https://www.ansd.sn", domain: "Population", verifiedAt: "2026-09-01",
  }],
  meta: {
    model: "test", retrievedAt: "2026-10-08T12:00:00Z", guard: "passed", violations: [], toolCalls: [],
    latencyMs: 100, language: "fr", cached: false, permalink: "abc12345", attribution: "Données ANSD",
  },
};
