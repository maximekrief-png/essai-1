# Projet : outil de prospection du Swiss Knowhow Magazine

Ce fichier sert de mémoire au projet. À lire en début de session.

## Contexte

- **COM Consulting** (dirigeant : Marc Krief) édite le **Swiss Knowhow Magazine**, un magazine institutionnel, depuis une vingtaine d'années.
- Chaque dossier est monté avec des **partenaires éditoriaux « officiels »** : cantons, administrations, associations. Ils fournissent parfois une liste d'entreprises à contacter.
- Maxime (fils de Marc) prospecte au téléphone sous le nom **« Jacques Dupraz »**. Il présente le dossier et les officiels pertinents selon le secteur et la localisation du prospect.
- Objectif d'un appel : un **RDV de 15 à 20 minutes** pour Marc. En RDV, Marc présente les anciens numéros, le sommaire, la diffusion et le chemin de fer, puis signe des contrats de parution one-shot.

## Dossier en cours : « Conférence des directeurs cantonaux » 2026

C'est une réédition du dossier consacré aux travaux publics de Suisse romande. Ordre de prospection : **Neuchâtel**, puis **Genève**.

| Canton | Officiels interviewés (sommaire) |
|---|---|
| Neuchâtel | Jean-Michel Deicher, architecte cantonal et chef du service des bâtiments · Nicolas Merlotti, ingénieur cantonal et chef du service des ponts et chaussées |
| Genève | Francesco della Casa, architecte cantonal · Christian Gorce, ingénieur cantonal |
| Vaud | Emmanuel Ventura, architecte cantonal · Pierre-Yves Gruaz, directeur général de la DGMR |
| Jura | Yves-Alain Fleury, chef du Service des infrastructures · Cyril Vallat, responsable de la Section des bâtiments et domaines |

Le sommaire ne liste que ces interviews : les objets présentés (projets, chantiers) sont notés fiche par fiche dans la colonne « Projet à évoquer (Deicher) ».

## Outils existants

- **CRM** : Google Sheet « Outil_Prospection_Swiss_Label », sur le Drive du compte Google Workspace d2bagencement.fr. Onglet `PROSPECTION` (une ligne par entreprise, ID de type E0001) et onglet `HISTORIQUE` (parutions passées, montants). Toute nouvelle fiche suit les colonnes de `PROSPECTION` (copie de l'en-tête : `templates/prospects.csv`).
- **Agenda** : calendrier « RENDEZ VOUS MARC KRIEF » (RDV physiques uniquement, avec adresse complète) et calendrier « Rappels téléphoniques Com Consulting » (rappels). Protocole : `docs/planning.md`.
- **Apollo** (enrichissement) et **ElevenLabs** (voix de Maxime déjà créée).
- Script d'appel : `docs/script-appel.md`. Outils proposés : `docs/outils.md`.

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
- **« Recommandé par M. X »** ne se dit que si la fiche a cette source (colonne « Donné par / source »).
- **Publireportage** : c'est un contenu payant. On ne dit jamais « ce n'est pas de la publicité ».
- **Enregistrement des appels** : l'annoncer à l'interlocuteur (CP art. 179ter).
- **Tentatives** : 5 au maximum par contact, puis on arrête.
- **Notes d'appel** : factuelles, jamais de jugement sur la personne. Les personnes ont un droit d'accès à leurs données (LPD art. 25).

## Conventions

- Langue : français.
- Format du listing : colonnes de l'onglet `PROSPECTION` du Google Sheet (en-tête copié dans `templates/prospects.csv`).
