import type { AskResponse, CitedRecord } from "./types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

export function citationFor(r: CitedRecord, consultedAt = new Date()): string {
  return `ANSD, « ${r.name} », ${r.territory}, ${r.period} : ${r.formattedValue}. ${r.source}. ${r.url} (consulté le ${dateFormat.format(consultedAt)} via SamaStat).`;
}

/** Texte complet d'une réponse pour le presse-papiers ou le partage : réponse, valeurs, sources, attribution. */
export function shareText(r: AskResponse): string {
  const lines = [r.answer, ""];
  for (const d of r.data) {
    lines.push(`${d.name} — ${d.territory}, ${d.period} : ${d.formattedValue}`);
    lines.push(`Source : ${d.source} — ${d.url}`);
  }
  for (const s of r.surveys) lines.push(`Enquête ANADS : ${s.label} — ${s.url}`);
  const link = r.meta.permalink && typeof window !== "undefined" ? `${window.location.origin}/r/${r.meta.permalink}` : null;
  lines.push("", `Réponse SamaStat du ${dateFormat.format(new Date(r.meta.retrievedAt))}.${link ? ` ${link}` : ""}`, r.meta.attribution);
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareOrCopy(title: string, text: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch {
      // annulé ou refusé : on retombe sur la copie
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}

/** Lecture à voix haute par la synthèse vocale du navigateur (français). */
export function speak(text: string, onEnd: () => void, language = "fr-FR"): (() => void) | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = language;
  u.rate = 0.95;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
  if (voice) u.voice = voice;
  u.onend = onEnd;
  u.onerror = onEnd;
  synth.speak(u);
  return () => {
    synth.cancel();
    onEnd();
  };
}
