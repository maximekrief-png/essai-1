# Consigne : texte intégral des interviews

Objectif : publier sur le site le **texte complet** de chaque interview (articles `"type": "interview"`)
des magazines Swiss Knowhow, tel qu'il est paru — **retranscription fidèle, pas de réécriture ni de résumé**.
(Contenus appartenant à l'éditeur du site, Com Consulting Sàrl.)

WORK=/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad

## Où trouver le texte
Pour un article `a` du magazine `<slug>` (`/home/user/essai-1/data/magazines/<slug>.json`) :
1. Pages : `a.pdfPages` (avec `a.imagePdf` éventuel = nom du dossier texte), sinon l'entrée
   `"<slug>:<a.slug>"` de `/home/user/essai-1/data/pagemap.json` (`{"pdf": "web-<slug>", "pages": [...]}`),
   sinon cherche le titre / le nom de la personne interviewée dans les pages.
2. Texte par page du PDF : `$WORK/text/<dossier>/p001.txt`, p002.txt… Dossiers : `web-<slug>` (PDF complet
   du site, à privilégier), ou `<imagePdf>` / `<slug>` pour les PDF locaux. `region-bernoise` → `web-region-bernoise`.
   Regarde les pages voisines (±2) : une interview déborde souvent sur la page suivante.
3. **Arc jurassien 2013** : les PDF sont des images sans texte. Utilise l'outil
   `mcp__Google_Drive__read_file_content` (charge-le avec ToolSearch `select:mcp__Google_Drive__read_file_content,mcp__Google_Drive__search_files`)
   sur le PDF de l'article dans le dossier Drive `1w18MID1W_f0s_JK7BIDAhn9pKP9qrDHy`
   (liste : `search_files` avec `parentId = '1w18MID1W_f0s_JK7BIDAhn9pKP9qrDHy'`, pageSize 100, excludeContentSnippets true ;
   noms `AJ2013_<sujet>_p<pages>.pdf`). Le résultat est sauvegardé dans un fichier JSON : `jq -r .fileContent <chemin>`.

## Comment retranscrire
- Reconstituer l'ordre de lecture : le texte extrait mélange parfois les colonnes ; remets les phrases dans
  l'ordre logique (le sens doit être continu).
- Supprimer : en-têtes/pieds techniques (« Projet1_Mise en page… », dates d'imposition, n° de page,
  « www.swissknowhowmagazine.ch »), publicités et textes d'autres articles de la même page, légendes
  photo isolées, bloc de coordonnées final (il est déjà dans la fiche entreprise).
- Recoller les mots coupés en fin de ligne (« décol- letage » → « décolletage ») et les paragraphes ;
  corriger les seuls artefacts d'extraction évidents. **Ne pas** corriger le style ni reformuler.
- Questions de l'intervieweur → bloc `"q"` ; réponses et paragraphes → `"p"` ; intertitres → `"h"` ;
  chapeau/introduction en tête → `"p"`.
- Interview publiée en deux langues (FR + DE/IT/EN) : ne garder qu'une version, **le français s'il existe**,
  sinon la langue d'origine. Indique la langue gardée dans `lang`.
- Si une partie est illisible ou manquante, garde le reste et signale-le dans `note`.
- Si l'article n'est pas vraiment une interview, ou si tu ne trouves pas son texte : ne l'inclus pas,
  mais liste-le dans ta réponse finale.

## Livrable
Un fichier par magazine : `/home/user/essai-1/data/texts/<slug>.json`
```json
{
  "<a.slug exact>": {
    "lang": "fr",
    "pages": "p. 4-5",
    "blocks": [
      {"t": "p", "x": "Chapeau…"},
      {"t": "q", "x": "Question ?"},
      {"t": "p", "x": "Réponse…"},
      {"t": "h", "x": "Intertitre"}
    ],
    "note": ""
  }
}
```
Valide : `python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(len(d), sum(len(v['blocks']) for v in d.values()))" <fichier>`.
Ne modifie aucun autre fichier, pas de commit. Réponse finale courte : par magazine, nombre d'interviews
retranscrites / total, et la liste des interviews non trouvées ou incomplètes.
