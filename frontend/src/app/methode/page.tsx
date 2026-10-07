import Link from "next/link";
import { AppShell } from "@/components/app-shell";


/** Page Méthode : ce que SamaStat fait, ne fait pas, et comment chaque réponse peut être vérifiée. */
export default function MethodePage() {
  return (
    <AppShell current="/methode">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1 space-y-10">
        <header>
          <h1 className="display text-[2rem]">Méthode</h1>
          <p className="mt-3 max-w-prose text-text-muted leading-relaxed">
            SamaStat est une couche d&apos;accès conversationnelle aux statistiques publiées par l&apos;Agence Nationale de la
            Statistique et de la Démographie. Il ne produit aucune donnée, n&apos;estime rien et ne se substitue à aucune
            plateforme de l&apos;ANSD : il renvoie vers elles.
          </p>
        </header>

        <Section title="Le modèle de langage n'écrit jamais un chiffre">
          <p>
            Le modèle comprend la question, choisit l&apos;indicateur dans le catalogue au moyen d&apos;outils, puis rédige une
            phrase où chaque valeur est un emplacement. Le serveur remplace ces emplacements par les enregistrements
            de la base. Si le texte du modèle contient un chiffre écrit par lui, ou un emplacement vers un enregistrement
            qu&apos;il n&apos;a pas réellement récupéré, la phrase est rejetée et remplacée par un texte construit uniquement
            à partir des enregistrements. Cette garde apparaît dans les étapes de chaque réponse.
          </p>
        </Section>

        <Section title="Chaque réponse est vérifiable">
          <ul className="list-disc pl-5 space-y-1">
            <li>Les étapes réelles du traitement (recherche, valeurs récupérées, garde) sont affichées, puis repliées.</li>
            <li>Sous chaque valeur : le champ (territoire, période), la source ANSD avec son lien, la date à laquelle la valeur a été relue sur la publication, et l&apos;identifiant de l&apos;enregistrement.</li>
            <li>La fiche de chaque indicateur donne ses séries par période et par territoire, une citation prête à copier, et des exports CSV, JSON et SDMX.</li>
            <li>Chaque réponse a un lien permanent, partageable sans compte.</li>
          </ul>
        </Section>

        <Section title="Quand la donnée n'existe pas">
          <p>
            Le système le dit, propose des reformulations que le catalogue peut satisfaire, et oriente le cas échéant
            vers l&apos;enquête du catalogue ANADS la plus proche, avec ses métadonnées uniquement. Il ne comble jamais une
            absence par une estimation, une projection ou une moyenne.
          </p>
        </Section>

        <Section title="Sources">
          <p>
            Publications de l&apos;ANSD relues une à une : RGPH-5 (2023, résultats définitifs), EHCVM II (2021-2022), ENES
            (2026), IHPC, comptes nationaux base 2021 ; catalogue ANADS (286 enquêtes et recensements). Liste et dates
            de vérification dans le{" "}
            <Link href="/catalogue" className="underline underline-offset-4">
              catalogue
            </Link>
            . Données sous licence Creative Commons Attribution 4.0, conformément à l&apos;Accord de licence de données
            ouvertes de l&apos;ANSD.
          </p>
        </Section>

        <Section title="Wolof">
          <p>
            Approche graduée : un lexique de formulations courantes, puis une traduction automatique locale (NLLB-200)
            dont la version wolof d&apos;une réponse est produite après avoir protégé chaque valeur, période et source, et
            une voix wolof expérimentale. Les erreurs de traduction ne peuvent pas toucher un chiffre.
          </p>
        </Section>

        <Section title="Vie privée et usage">
          <p>
            Les questions sont conservées sans aucun identifiant d&apos;utilisateur. Le tableau de bord{" "}
            <Link href="/usage" className="underline underline-offset-4">
              Usage
            </Link>{" "}
            restitue à l&apos;ANSD les indicateurs demandés, les questions restées sans donnée et les langues des
            demandes, pour orienter la programmation statistique.
          </p>
        </Section>

      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-prose">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-text space-y-2">{children}</div>
    </section>
  );
}
