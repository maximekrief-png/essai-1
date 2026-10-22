# Swiss Knowhow — annuaire

Site statique (HTML/CSS/JS, sans dépendance) qui reprend le contenu des magazines
**Swiss Knowhow** : annuaire des entreprises avec coordonnées, articles et interviews,
thèmes, recherche instantanée et onglet **Magazines PDF** (miniatures + téléchargement).

## Structure

| Dossier | Rôle |
|---|---|
| `data/magazines/*.json` | Données extraites des PDF, un fichier par magazine (format : `data/SCHEMA.md`) |
| `data/images.json` | Photos associées aux articles/entreprises (généré) |
| `tools/build.mjs` | Générateur : lit `data/` et écrit tout le site dans `docs/` |
| `tools/extract_images.py` | Extrait les photos des PDF locaux → `docs/assets/img/` |
| `tools/ingest.sh` | Décode un PDF téléchargé depuis Google Drive, extrait texte + couverture |
| `docs/` | **Site publié** (GitHub Pages : Settings → Pages → branche, dossier `/docs`) |

## Commandes

```bash
npm run images   # (optionnel) extraire les photos des PDF présents localement
npm run build    # régénérer le site dans docs/
npm run serve    # aperçu sur http://localhost:8080
```

## Fonctionnalités

- **Annuaire** : fiches entreprise (présentation, adresse, téléphone, e-mail, site, interlocuteurs,
  lien carte, parutions), filtres par thème, canton, lettre, masquage des annonceurs seuls.
- **Articles** : résumé, citation, personnes, entreprises liées, lien vers le PDF.
- **Thèmes** : 11 secteurs (horlogerie, industrie, santé, construction, collectivités…).
- **Recherche** : instantanée (Ctrl K ou /), insensible aux accents, sur entreprises, personnes,
  villes, articles et magazines ; page `/recherche/?q=…`.
- **Magazines PDF** : toutes les éditions avec couverture, téléchargement et lecture en ligne.
- Mode sombre, responsive mobile, données structurées schema.org (SEO).

## Points d'attention

- Les boutons PDF pointent vers Google Drive : **les fichiers doivent être partagés
  « Tous les utilisateurs disposant du lien »** pour que le public puisse les télécharger.
- Les PDF de plus de ~6 Mo n'ont pas pu être téléchargés par le connecteur Drive : leur texte a été
  extrait, mais ni couverture ni photos. Pour les ajouter, déposez une image de couverture
  `docs/assets/covers/<slug>.webp` (slug = nom du fichier JSON) ou placez le PDF dans le dossier
  de travail et relancez `tools/ingest.sh` + `npm run images` + `npm run build`.
- Résumés rédigés à partir des magazines ; les coordonnées sont celles imprimées (pas de vérification
  de leur actualité).
