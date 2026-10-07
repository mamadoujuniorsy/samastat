# Sources de données : état vérifié au 15 septembre 2026

Ce document consigne ce qui a été **réellement vérifié** en ligne lors de la constitution du jeu de test
du Jalon 1. Il doit être mis à jour à chaque nouvelle vérification. Aucune valeur non relue sur une page
ANSD ne doit entrer dans la base.

## Site officiel ANSD (ansd.sn) : source du jeu de test

Toutes les valeurs de `backend/src/database/seed/indicators.json` proviennent de ces pages :

| Page | Contenu utilisé |
|---|---|
| https://www.ansd.sn/actualite/les-principaux-resultats-du-5e-recensement-general-de-la-population-et-de-lhabitat-du | Population totale RGPH-5, taux de croissance 2013-2023, ISF, espérance de vie |
| https://www.ansd.sn/sites/default/files/recensements/rapport/Chapitre-1_ETAT-STRUCTURE-POPULATION-Rapport-def-RGPH-5.pdf | Population par sexe, population par région (tableau I-21) |
| https://www.ansd.sn/Indicateur/evolution-annuelle-de-lindice-harmonise-des-prix-la-consommation | Inflation annuelle IHPC 2023, 2024, 2025 |
| https://www.ansd.sn/Indicateur/enquete-emploi | ENES T1 2026 : chômage élargi (national, rural, urbain), chômage BIT, taux de participation |
| https://www.ansd.sn/actualite/resultats-sur-les-tendances-de-la-pauvrete-au-senegal | EHCVM II : pauvreté monétaire (national, rural, urbain, 4 régions), extrême pauvreté |

Seconde collecte (même jour, 42 indicateurs supplémentaires, fichiers téléchargés avec `curl -k` puis
convertis avec `pdftotext`) :

| Page | Contenu utilisé |
|---|---|
| Chapitre 1 RGPH-5 (PDF ci-dessus), tableau I-21 | Population des 9 autres régions (somme des 14 régions : 18 126 388, écart de 2 avec le total national, arrondi ANSD) |
| Chapitre 1, tableaux I-19 et I-28 | Âge médian, âge moyen, part des moins de 15 ans, des 65 ans et plus, ratio de dépendance, taux d'urbanisation |
| https://www.ansd.sn/sites/default/files/recensements/rapport/Chapitre-2_EDUCATION-Rapport-def-RGPH-5.pdf | Taux d'alphabétisation des 6 ans et plus (résumé) |
| https://www.ansd.sn/sites/default/files/recensements/rapport/Chapitre-5_MORTALITE-Rapport-def-RGPH-5.pdf | Quotients de mortalité infantile et infanto-juvénile |
| https://www.ansd.sn/sites/default/files/recensements/rapport/Chapitre-9_MENAGES-Rapport-def-RGPH-5.pdf | Nombre de ménages, ménages ordinaires, taille moyenne (tableau IX-8) |
| Page « principaux résultats » RGPH-5 | Part des moins de 35 ans, taux brut de scolarisation au primaire |
| https://www.ansd.sn/sites/default/files/2024-07/Rapport_Final_EHCVM_2021-2022_VF.pdf, tableau III-2 | Taux de pauvreté des 10 autres régions |
| Page « tendances de la pauvreté » | Insécurité alimentaire modérée ou sévère (2022) |
| https://www.ansd.sn/Indicateur/comptes-nationaux-du-senegal-base-2021 | Croissance du PIB 2023 et 2024, croissance hors pétrole, taux d'épargne nationale |
| https://www.ansd.sn/Indicateur/donnees-de-population | Population projetée 2025, taux brut de mortalité |
| https://www.ansd.sn/Indicateur/indice-harmonise-des-prix-la-consommation-ihpc-base-100-en-2023 | Inflation en glissement annuel, août 2026 |
| https://www.ansd.sn/Indicateur/note-sur-les-evolutions-economiques-recentes-neer | PIB trimestriel CVS, T4 2025 |

La liste des pages « Indicateur » est sur https://www.ansd.sn/indicateurs (le chemin `/Indicateur` seul renvoie 404).

Troisième collecte (19 septembre 2026) :

| Page | Contenu utilisé |
|---|---|
| Chapitre 1 RGPH-5, tableau I-8 (p. 28-29), extrait avec pdfplumber | Population des 46 départements ; contrôle : la somme des départements de chaque région redonne exactement le total régional |
| Chapitre 1 RGPH-5, notes du tableau I-8 | Population de 5 communes du département de Keur Massar (Yeumbeul Nord, Yeumbeul Sud, Malika, Keur Massar, Jaxaay-Parcelles-Niakoul Rap) |
| https://www.ansd.sn/sites/default/files/2024-06/EDS-C_2023-indicateurs-cles.pdf | EDS-Continue 2023 : mortalité néonatale, infantile, infanto-juvénile, contraception, fécondité des adolescentes, soins prénatals, accouchements assistés, vaccination, malnutrition, moustiquaires |
| https://www.ansd.sn/sites/default/files/2024-07/Rapport-tableaux-EDS-C_2023.pdf (tableau 14.4) | Rapport de mortalité maternelle |
| https://www.ansd.sn/sites/default/files/2025-02/Section-C_Conditions-sociales_SESN2022-2023.pdf (chapitre X) | Médecins, postes et centres de santé, hôpitaux (2022, source MSAS) |

Écartés : prévalence du VIH et parasitémie palustre (absentes de l'EDS-C 2023), affiliation à l'assurance
maladie (tableau SESN 2024 de source DGPSN, confiance moyenne). Les déclinaisons régionales des indicateurs
EDS existent dans les mêmes tableaux mais l'extraction texte décale des lignes : à reprendre avec pdfplumber.

Écartés faute de vérification fiable : la densité de Dakar (deux valeurs divergentes entre la page
« principaux résultats » et le rapport définitif), le taux d'alphabétisation des 10 ans et plus (deux
valeurs dans le même rapport, 62,2 % et 62,9 %), le taux d'emploi T1 2026 (vu seulement dans un titre
d'actualité) et la part des moins de 25 ans (non publiée explicitement).

Note technique : le certificat TLS de ansd.sn et de anads.ansd.sn n'est pas reconnu par les clients HTTP
standards (chaîne incomplète). Un connecteur devra embarquer le certificat intermédiaire ou l'autorité
racine plutôt que de désactiver la vérification.

## Plateforme Open Data (senegal.opendataforafrica.org) : bloquée pour les robots

Au 15 septembre 2026, toutes les URL testées (pages de jeux de données et endpoints `/api/1.0/...`)
renvoient HTTP 403 avec un challenge JavaScript Cloudflare. Les pages existent (les métadonnées HTML
le confirment pour `hqewrmc`, « Principaux indicateurs de la santé au Sénégal ») mais leur contenu
et la forme de l'API n'ont pas pu être vérifiés.

Conséquence pour le Jalon 3 : le connecteur ODP ne peut pas être écrit « à l'aveugle ». Options à
explorer, dans l'ordre : demander à l'ANSD un accès API ou une clé, télécharger manuellement les
exports CSV depuis un navigateur et les versionner, ou vérifier si un autre domaine de la plateforme
répond sans challenge.

URL testées et bloquées : `/hfhored/etablissements-de-sante`, `/obvklwd/exportations-et-importations-par-pays`,
`/hqewrmc`, `/bzzjuq/matrice-des-indicateurs-odin`, `/api/1.0/meta/dataset`, `/api/1.0/meta/dataset/{id}`,
`/api/1.0/data/hfhored`.

## ANADS (anads.ansd.sn) : API NADA fonctionnelle, sans clé

Catalogue de 286 études. Endpoints vérifiés :

- `GET /index.php/api/catalog/search?sk=<mot-clé>&ps=<taille>` renvoie `result.rows[]` avec
  `id, idno, title, year_start, year_end, authoring_entity, url`.
- `GET /index.php/api/catalog/<idno>` renvoie la fiche (`dataset`). Par identifiant numérique :
  `/index.php/api/catalog/<id>?id_format=id`.

Fiches vérifiées : RGPH-5 (`SEN-ANSD-RGPH5-2023-V1.1`, catalog/311), EHCVM II
(`SEN-ANSD-EHCVM-2021-2022-V1.0`, catalog/310), ENES T4 2025 (`SEN-ANSD-ENES-T4-2025-V1.0`, catalog/352).

## Répertoire des localités RGPH-5

La page https://www.ansd.sn/mademba/repertoire-des-localites-issu-du-rgph-5-2023 renvoie vers
https://www.ansd.sn/donnees-recensements, une vue interactive (filtres année et région) sans export
CSV ou XLSX exposé. Les rapports régionaux définitifs (PDF, avril 2026) sont listés sur
https://www.ansd.sn/rapports/rgph-5-2023. Le niveau commune / village demandera donc soit une
extraction depuis ces PDF, soit un fichier fourni par l'ANSD.
