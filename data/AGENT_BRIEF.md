# Consigne d'extraction (agents)

Objectif : transformer des magazines PDF « Swiss Knowhow » (stockés sur Google Drive) en données
structurées pour un site annuaire : articles, thèmes, entreprises et leurs coordonnées.

Lis d'abord `/home/user/essai-1/data/SCHEMA.md` (format exact du JSON à produire).

Variables :
- WORK=/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad
- Repo : /home/user/essai-1

## Obtenir le texte
1. Si `$WORK/text/<slug>/p001.txt` existe déjà, le PDF est local : le texte est découpé par page
   du PDF (`p001.txt` = page 1). Utilise ces fichiers, mets `"pdfLocal": true` et remplis `pdfPages`.
2. Sinon appelle l'outil `mcp__Google_Drive__read_file_content` (charge-le avec ToolSearch
   `select:mcp__Google_Drive__read_file_content,mcp__Google_Drive__download_file_content` si besoin)
   avec le `driveId`. Le résultat est trop gros : il est sauvegardé dans un fichier JSON dont le chemin
   est indiqué. Extrais le texte : `mkdir -p $WORK/text/<slug> && jq -r .fileContent <chemin> > $WORK/text/<slug>/drive.txt`
   puis lis-le par tranches (Read avec offset/limit, ~400 lignes à la fois) jusqu'à 100 %.
   Dans ce cas `"pdfLocal": false` et `pdfPages: []` partout.
3. **N'appelle JAMAIS `download_file_content` sur un fichier de plus de 5,8 Mo** : au-delà le
   connecteur plante et coupe l'accès Drive à tous les autres agents.
   Si un fichier ≤ 5,8 Mo doit être téléchargé (consigne explicite), après l'appel lance
   `/home/user/essai-1/tools/ingest.sh <chemin-du-json> <slug-local>` : cela crée le PDF local,
   le texte par page dans `$WORK/text/<slug-local>/` et la couverture.

## Règles de contenu
- Lis l'intégralité du texte. Relève **chaque** article (interviews, publireportages, éditoriaux,
  dossiers, portraits) et **chaque** entreprise/organisation, y compris les annonceurs
  (`advertiserOnly: true` si seulement une publicité).
- Coordonnées : recopie exactement adresse, NPA, ville, téléphone, e-mail, site web trouvés dans le
  texte (souvent en fin de publireportage ou dans l'annonce). Ne JAMAIS inventer ni compléter de mémoire.
- Résumés et descriptions : en français, rédaction originale (pas de copier-coller de paragraphes),
  citation ≤ 25 mots. Les titres d'articles restent dans leur langue d'origine.
- Si deux fichiers sont la même édition (texte quasi identique), produis **un seul** JSON qui liste
  les deux fichiers dans `files`. Si ce sont des contenus différents, produis un JSON par contenu
  (ajoute un suffixe au slug, ex. `horlogerie-2017-revue`).
- Slugs d'entreprises : minuscules, a-z0-9 et tirets, sans accents (ex. « Hôpital du Jura bernois SA »
  → `hopital-du-jura-bernois`). Retire SA/AG/Sàrl/GmbH du slug, garde-les dans `name`.
- Champ optionnel `"imagePdf"` sur un article/entreprise : slug du PDF local d'où tirer l'image
  (par défaut le slug du magazine). Utile uniquement si les pages viennent d'un autre PDF local.

## Livrable
- Écris `/home/user/essai-1/data/magazines/<slug>.json` (UTF-8, indenté 2 espaces).
- Valide : `python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(len(d['articles']),len(d['companies']))" <fichier>`
- Ne modifie aucun autre fichier du dépôt, ne fais pas de commit git.
- Réponse finale (courte) : pour chaque JSON écrit, nombre d'articles / d'entreprises, combien
  d'entreprises ont au moins un téléphone, e-mail ou site, et toute difficulté (texte illisible,
  pages manquantes, doublons détectés).
