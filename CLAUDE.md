# Projet : outil de prospection du Swiss Knowhow Magazine

Ce fichier sert de mémoire au projet. À lire en début de session.

## Contexte

- **COM Consulting** (dirigeant : Marc Krief) édite le **Swiss Knowhow Magazine**, un magazine institutionnel, depuis une vingtaine d'années.
- Chaque dossier est monté avec des **partenaires éditoriaux « officiels »** : cantons, administrations, associations. Ils fournissent parfois une liste d'entreprises à contacter.
- Maxime (fils de Marc) prospecte au téléphone sous le nom **« Jacques Dupraz »**. Il présente le dossier et les officiels pertinents selon le secteur et la localisation du prospect.
- Objectif d'un appel : un **RDV de 15 à 20 minutes** pour Marc. En RDV, Marc présente les anciens numéros, le sommaire, la diffusion et le chemin de fer, puis signe des contrats de parution one-shot.

## Pipeline cible

1. **Sommaire** : le dossier (rubriques, territoire, officiels).
2. **Ciblage** : les secteurs et types d'entreprises concernés par chaque rubrique.
3. **Listing** : les entreprises (listes des officiels, marchés publics, registre du commerce, Apollo, web).
4. **Enrichissement** : le dirigeant, son portable ou sa ligne directe, son e-mail, l'adresse et une accroche sourcée.
5. **Appels** : la déballe, puis le passage du barrage secrétaire et la prise de RDV.
6. **Agenda de Marc** : placer les RDV en optimisant les trajets. Les RDV ajoutés à la main doivent être pris en compte.

Procédure des étapes 1 à 4 : skill `ciblage-sommaire` (`.claude/skills/ciblage-sommaire/SKILL.md`).

## Règles non négociables

- **Astérisque dans l'annuaire** (search.ch / local.ch) = le numéro ne doit pas être démarché (LCD art. 3 al. 1 let. u). Le prospect passe au statut `NE_PAS_APPELER`.
- **Numéro appelant** : il doit être affiché et inscrit à l'annuaire (LCD art. 3 al. 1 let. v).
- **Pas de prospection téléphonique entièrement automatisée** (sans humain en ligne) sans avis juridique écrit préalable. Base : LCD art. 3 al. 1 let. o et position du SECO, selon laquelle l'appelé doit être mis en relation avec une personne.
- **Une IA qui parle à un tiers ne nie jamais être une IA** quand on le lui demande. Base : LPD et position du PFPDT, qui reconnaît le droit de savoir qu'on communique avec une machine. Une voix naturelle est permise ; se faire passer pour un humain ne l'est pas.
- **Données personnelles** (LPD) : collecter le minimum, indiquer la source de chaque donnée, supprimer sur demande. **Aucun listing de prospects dans Git** : le dossier `listings/` est ignoré et les listings vivent dans Google Sheets.
- **Crédits Apollo** : la recherche est gratuite mais l'enrichissement (e-mails, téléphones) consomme des crédits. Annoncer le coût estimé et obtenir l'accord avant chaque enrichissement.
- **Accroches** : ne jamais inventer un fait. Chaque fait cité à un prospect a une source (URL).

## Conventions

- Langue : français.
- Format du listing : `templates/prospects.csv` (une ligne par entreprise, colonnes en snake_case sans accents).
