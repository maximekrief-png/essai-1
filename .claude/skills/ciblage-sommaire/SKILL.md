---
name: ciblage-sommaire
description: Transforme le sommaire d'un dossier du Swiss Knowhow Magazine en listing d'entreprises à démarcher, ou complète les fiches existantes (dirigeant, coordonnées, filtre annuaire, accroche sourcée), dans le Google Sheet « Outil_Prospection_Swiss_Label ». À utiliser dès que l'utilisateur fournit un sommaire, un dossier ou une liste d'officiels, ou qu'il veut des prospects ou compléter des fiches.
---

# Ciblage à partir d'un sommaire

Lire d'abord `CLAUDE.md` : contexte, dossier en cours, règles non négociables.

## Étape 0 : partir de l'existant

1. Exporter l'onglet `PROSPECTION` du Google Sheet en CSV (connecteur Google Drive, `download_file_content`, `text/csv`), dans le scratchpad. **Jamais dans le repo.**
2. Pour le canton visé, compter :
   - les fiches restant à appeler, avec et sans numéro ;
   - les dirigeants manquants ;
   - les sources déjà exploitées (colonne « Donné par / source »).
3. **Compléter les fiches existantes sans numéro passe avant la recherche de nouvelles entreprises.**

## Étape 1 : analyser le sommaire

Extraire du sommaire :
- le **territoire** (canton, région, commune) ;
- les **officiels / partenaires** et leur rôle ;
- les **rubriques** (articles, thèmes, projets cités, chantiers, politiques publiques).

Si le sommaire ne liste que des interviews d'officiels, les rubriques se déduisent de leurs services. Exemples : bâtiments publics pour l'architecte cantonal ; routes, ponts et ouvrages d'art pour l'ingénieur cantonal.

Produire une **carte de ciblage** : un tableau avec une ligne par rubrique et les colonnes suivantes.

| rubrique | secteurs visés | types d'entreprises | tailles | zone | officiel à citer | angle d'accroche |

Penser à la **chaîne de valeur** d'un projet : maître d'ouvrage, architectes, ingénieurs civils et CVSE, entreprises générales, gros œuvre, second œuvre, fournisseurs.

**Point d'arrêt** : présenter la carte à l'utilisateur et attendre sa validation avant toute recherche.

## Étape 2 : sourcer les entreprises

Par ordre de priorité :
1. **Listes fournies par les officiels.** Source : « Recommandé par [nom] ». Priorité `1 · Prioritaire`.
2. **Marchés publics** (si le dossier porte sur un territoire) :
   - adjudications SIMAP (simap.ch) : nom de l'adjudicataire, objet du marché, lot ;
   - rapports de jury des concours ;
   - feuilles d'avis officielles cantonales (mises à l'enquête) ;
   - sites des communes et du canton.

   L'objet et le lot vont dans « Projet à évoquer (Deicher) ».
3. **Registre du commerce** (Zefix, FOSC) : recherche par but social et par siège. Donne l'IDE et les personnes inscrites.
4. **Associations professionnelles et chambres de commerce cantonales** : annuaires des membres.
5. **Apollo** : d'abord les outils gratuits (`apollo_organizations_lookup`, `apollo_mixed_people_api_search`). Sa couverture en Suisse est biaisée vers les entreprises présentes sur LinkedIn : elle ne suffit jamais seule pour les PME traditionnelles.
6. **Recherche web** pour combler les trous. Si un site est bloqué par le proxy, passer par `WebSearch`.

Dédoublonner contre le Sheet existant, par IDE, sinon par raison sociale et ville. Les nouvelles fiches reprennent la numérotation de la colonne `ID`.

## Étape 3 : identifier le dirigeant

On ne veut que le dirigeant :
- SA : président du conseil d'administration, administrateur unique ou directeur général ;
- Sàrl : associé gérant ;
- raison individuelle : le titulaire.

Le dirigeant va dans le bloc « DIRIGEANT 1 ». Un second décideur éventuel va dans « DIRIGEANT 2 ».

1. Source de référence : les personnes inscrites au **registre du commerce** avec signature.
2. Recouper avec le site web de l'entreprise, LinkedIn et Apollo.
3. Si le dirigeant reste introuvable : écrire `DIRIGEANT À DEMANDER` dans « Notes d'appel ». La question sera posée à la secrétaire en fin d'appel.

## Étape 4 : coordonnées

1. Site web de l'entreprise : ligne directe, e-mail nominatif.
2. Annuaire (search.ch, local.ch) : standard et **vérification de l'astérisque**.
3. **Enrichissement Apollo** (`apollo_people_bulk_match` : e-mail, direct, portable). Il est payant :
   - annoncer à l'utilisateur le nombre de personnes et le coût estimé en crédits ;
   - attendre son accord ;
   - reporter les crédits consommés et le solde.

   N'enrichir que les fiches `1 · Prioritaire` et `2 · À travailler`.
4. Renseigner « Fiabilité email » (Vérifié / Probable / À vérifier).

## Étape 5 : conformité

- Astérisque présent dans l'annuaire :
  - « Statut appel » = `NE PAS APPELER` ;
  - motif et date dans « Remarques de vérification » ;
  - ne pas chercher d'autre numéro pour contourner l'astérisque.
- Entreprise radiée : Priorité `5 · Radiée`.
- Chaque donnée ajoutée garde la trace de sa source dans « Donné par / source » ou « Remarques de vérification ».

## Étape 6 : accroche et priorité

- « Projet à évoquer (Deicher) » : l'objet ou le lot qui relie l'entreprise au dossier, avec sa source (URL) dans « Remarques de vérification ». Sans source, la case reste vide et l'accroche reste générique (version D du script).
- Priorité :
  - `1 · Prioritaire` : recommandé par un officiel, lié à un chantier du dossier, ou ancien annonceur ;
  - `2 · À travailler` : secteur ciblé, dans la zone ;
  - `3 · À qualifier` : lien incertain.
- « Statut appel » initial : `A APPELER`.

## Étape 7 : livraison

- Ajouter ou compléter les lignes dans l'onglet `PROSPECTION` du Google Sheet. Si l'écriture directe n'est pas possible, produire un CSV dans `listings/` (ignoré par Git) avec l'en-tête de `templates/prospects.csv`. **Ne jamais commiter un listing.**
- Rapport final, en quelques lignes :
  - fiches ajoutées ou complétées, par priorité ;
  - part avec dirigeant identifié ;
  - part avec portable, avec ligne directe, avec standard seul ;
  - nombre de numéros sous astérisque ;
  - crédits Apollo consommés ;
  - trous identifiés et sources à creuser.
