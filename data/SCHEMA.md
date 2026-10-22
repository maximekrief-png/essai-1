# Schéma des données — un fichier par magazine : `data/magazines/<slug>.json`

Toutes les descriptions/résumés sont rédigés **en français**, avec vos propres mots
(résumé original, pas de recopie de paragraphes). Citation (`quote`) : 25 mots max.
Champs inconnus : chaîne vide `""` ou tableau vide `[]` — **jamais inventer** une adresse,
un téléphone, un e-mail ou un site web. Recopier exactement ce qui figure dans le magazine.

```jsonc
{
  "slug": "horlogerie-2019",                 // fourni par la consigne
  "title": "Swiss Knowhow – Industrie horlogère 2019",
  "series": "Horlogerie",                    // collection : Horlogerie | Santé | Grands travaux | Collectivités | Économie régionale | Énergie
  "year": 2019,                              // année d'édition (nombre) ; 0 si inconnue
  "region": "Arc jurassien",                 // zone couverte (texte libre court)
  "languages": ["fr", "de"],
  "description": "2 à 4 phrases présentant le numéro.",
  "themes": ["horlogerie", "industrie"],     // ids de la taxonomie ci-dessous
  "files": [                                 // fichiers PDF sources (fournis par la consigne)
    { "driveId": "…", "name": "SWISS_HORLOGERIE_2019.pdf", "sizeMB": 11.6, "label": "Édition web" }
  ],
  "pdfLocal": false,                         // true si le PDF a été téléchargé localement (pages exploitables)
  "articles": [
    {
      "slug": "horlogerie-2019-interview-jean-dupont",   // <slug magazine>-<mots-clés>, minuscules, a-z0-9 et tirets
      "title": "Titre original de l'article",
      "subtitle": "Chapeau / sous-titre (court)",
      "type": "interview",                   // interview | publireportage | editorial | dossier | portrait | annonce
      "page": "04-05",                       // pagination imprimée (sommaire) si connue, sinon ""
      "pdfPages": [5, 6],                    // index de pages du PDF (1 = première page) — seulement si pdfLocal, sinon []
      "summary": "Résumé original de 80 à 160 mots en français.",
      "quote": "Courte citation marquante (≤ 25 mots) ou \"\"",
      "themes": ["horlogerie"],
      "region": "Bienne",
      "language": "de",                      // langue de l'article original
      "people": [{ "name": "Jean Dupont", "role": "CEO" }],
      "companies": ["dupont-sa"]             // slugs des entreprises liées (définies dans "companies")
    }
  ],
  "companies": [
    {
      "slug": "dupont-sa",                   // nom normalisé : minuscules, a-z0-9 et tirets, sans forme juridique superflue si non ambigu
      "name": "Dupont SA",
      "sector": "Décolletage de précision",
      "themes": ["horlogerie", "industrie"],
      "description": "40 à 100 mots en français : activité, savoir-faire, chiffres clés cités.",
      "address": "Rue de l'Industrie 12",
      "postalCode": "2500",
      "city": "Bienne",
      "canton": "BE",                        // code à 2 lettres pour la Suisse ; "" hors Suisse
      "country": "Suisse",
      "phone": "+41 32 000 00 00",
      "email": "info@dupont.ch",
      "website": "www.dupont.ch",
      "contacts": [{ "name": "Jean Dupont", "role": "Directeur" }],
      "page": "04",
      "pdfPages": [5],                       // pages du PDF où l'entreprise apparaît (seulement si pdfLocal)
      "advertiserOnly": false                // true si l'entreprise n'apparaît que via une annonce publicitaire
    }
  ]
}
```

## Taxonomie des thèmes (ids)

| id | Libellé |
|---|---|
| horlogerie | Horlogerie & microtechnique |
| industrie | Industrie & sous-traitance |
| construction | Construction & génie civil |
| architecture | Architecture, ingénierie & immobilier |
| energie | Énergie & environnement |
| sante | Santé & médical |
| collectivites | Collectivités & institutions publiques |
| economie | Économie, finance & services |
| formation | Formation, recherche & innovation |
| territoire | Territoire, tourisme & culture |
| mobilite | Transport & mobilité |

Entreprises au sens large : sociétés, bureaux, associations, institutions, communes, hôpitaux,
écoles — toute organisation qui a un article, une interview, un publireportage ou une annonce.
