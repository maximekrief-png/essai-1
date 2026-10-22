# Consigne de relecture (agents)

Objectif : corriger les **coquilles** des données du site (fautes d'orthographe, de grammaire, d'accord,
d'accents, de typographie, artefacts d'extraction PDF/OCR) **sans changer le sens ni les faits**.

Fichiers : `/home/user/essai-1/data/magazines/<slug>.json` (format : `/home/user/essai-1/data/SCHEMA.md`).
Texte source des PDF (pour vérifier un nom ou un chiffre) :
`/tmp/claude-0/-home-user-essai-1/47dc13f7-8829-53ad-81e9-612d09b1bf8b/scratchpad/text/web-<slug>/p001.txt…`
(`region-bernoise` → `web-region-bernoise`, `arc-jurassien-2013` → dossiers `aj2013-*` ; s'il n'existe pas, ignore la vérification).

## Champs à relire
- Magazine : `title`, `description`, `region`.
- Articles : `title`, `subtitle`, `summary`, `quote`, `region`, `people[].name`, `people[].role`.
- Entreprises : `name`, `sector`, `description`, `address`, `city`, `contacts[].name`, `contacts[].role`.

## À corriger
- Fautes d'orthographe, d'accord, de conjugaison, accents manquants ou erronés (« a » / « à », « ou » / « où »…).
- Artefacts d'extraction : lettres séparées (« R udolf »), césures restées (« décol- letage »), mots collés,
  espaces doubles, guillemets ou parenthèses non fermés, caractères parasites.
- Typographie française : guillemets « … », apostrophe cohérente, majuscules (noms propres, début de phrase),
  pas de MAJUSCULES intégrales dans les titres/noms sauf sigles (ex. « SWISS KNOWHOW » → « Swiss Knowhow »,
  mais « EPHJ », « HUG », « SA » restent).
- Noms de villes mal orthographiés (ex. « Le Locle », « La Chaux-de-Fonds », « Bienne/Biel », « Neuchâtel »).
- Même personne écrite de deux façons dans un même fichier : harmoniser sur la graphie du PDF.
- Titres en allemand/italien/anglais : corriger seulement les coquilles évidentes, ne pas traduire.

## Interdit
- Ne pas modifier : slugs, `page`, `pdfPages`, `imagePdf`, `themes`, `type`, `language`, `files`, `year`,
  ni les champs de contact `phone`, `email`, `website`, `postalCode`, `canton`, `country`
  (ils ont déjà été audités ; si tu vois une erreur évidente dans l'un d'eux, ne la corrige pas mais signale-la).
- Ne pas réécrire le style, ne pas raccourcir/allonger, ne pas ajouter d'informations.
- Citations (`quote`) : seulement les coquilles évidentes.

## Méthode
Lis chaque fichier en entier (par tranches). Applique les corrections avec un petit script Python qui charge le
JSON, remplace les chaînes exactes, puis réécrit le fichier (`json.dump(..., ensure_ascii=False, indent=2)`).
Valide ensuite : `python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(len(d['articles']),len(d['companies']))" <fichier>`.
Ne touche à aucun autre fichier, pas de commit git.

## Réponse finale (courte)
Par fichier : nombre de corrections ; 5 exemples représentatifs « avant → après » au total ;
et la liste des anomalies de contact repérées mais non corrigées.
