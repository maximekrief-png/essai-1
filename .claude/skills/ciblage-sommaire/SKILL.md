---
name: ciblage-sommaire
description: Transforme le sommaire d'un dossier du Swiss Knowhow Magazine en listing d'entreprises à démarcher, avec dirigeant, coordonnées, filtre annuaire et accroche sourcée, au format templates/prospects.csv. À utiliser dès que l'utilisateur fournit un sommaire, un dossier ou une liste d'officiels et veut des prospects.
---

# Ciblage à partir d'un sommaire

Lire d'abord `CLAUDE.md` : contexte et règles non négociables.

## Étape 1 : analyser le sommaire

Extraire du sommaire :
- le **territoire** (canton, région, commune) ;
- les **officiels / partenaires** et leur rôle ;
- les **rubriques** (articles, thèmes, projets cités, chantiers, politiques publiques).

Produire une **carte de ciblage** : un tableau avec une ligne par rubrique et les colonnes suivantes.

| rubrique | secteurs visés (et codes NOGA si possible) | types d'entreprises | tailles | zone | officiel à citer | angle d'accroche |

Penser large sur les tailles : du grand groupe à l'artisan. Penser aussi à la **chaîne de valeur**. Exemple : une rubrique « nouvel hôpital » vise le maître d'ouvrage, les bureaux d'ingénieurs, les entreprises générales, le second œuvre et les fournisseurs.

**Point d'arrêt** : présenter la carte à l'utilisateur et attendre sa validation avant toute recherche.

## Étape 2 : sourcer les entreprises

Par ordre de priorité :
1. **Listes fournies par les officiels** : toujours en premier, avec la priorité A.
2. **Marchés publics** (si le dossier porte sur un territoire) :
   - adjudications SIMAP (simap.ch) : le nom de l'adjudicataire, l'objet du marché et le montant ;
   - feuilles d'avis officielles cantonales (mises à l'enquête, autorisations de construire) ;
   - sites des communes et du canton (grands projets).

   Noter la référence dans `chantier_public_ref`. C'est la meilleure accroche : « vous travaillez sur X ».
3. **Registre du commerce** (Zefix, FOSC) : recherche par but social et par siège. Donne l'IDE et les personnes inscrites.
4. **Associations professionnelles et chambres de commerce cantonales** : annuaires des membres.
5. **Apollo** : d'abord les outils gratuits (`apollo_organizations_lookup`, `apollo_mixed_people_api_search`). Sa couverture en Suisse est biaisée vers les entreprises présentes sur LinkedIn : elle ne suffit jamais seule pour les PME traditionnelles.
6. **Recherche web** pour combler les trous. Si un site est bloqué par le proxy, passer par `WebSearch`.

Dédoublonner par IDE (sinon par raison sociale et NPA).

## Étape 3 : identifier le dirigeant

On ne veut que le dirigeant :
- SA : président du conseil d'administration, administrateur unique ou directeur général ;
- Sàrl : associé gérant ;
- raison individuelle : le titulaire.

1. Source de référence : les personnes inscrites au **registre du commerce** avec signature.
2. Recouper avec le site web de l'entreprise, LinkedIn et Apollo.
3. Si le dirigeant reste introuvable ou ambigu : `dirigeant_a_demander = oui`. La question sera posée à la secrétaire en fin d'appel.

Toujours remplir `source_dirigeant`.

## Étape 4 : coordonnées

1. Site web de l'entreprise : ligne directe, e-mail nominatif.
2. Annuaire (search.ch, local.ch) : numéro du standard et **vérification de l'astérisque** (`etoile_annuaire` et `date_verif_annuaire`).
3. **Enrichissement Apollo** (`apollo_people_bulk_match` : e-mail, direct, portable). Il est payant :
   - annoncer à l'utilisateur le nombre de personnes et le coût estimé en crédits ;
   - attendre son accord ;
   - reporter les crédits consommés et le solde.

   N'enrichir que les lignes de priorité A et B.

Ordre de préférence pour appeler : `tel_mobile`, puis `tel_direct`, puis `tel_standard`.

## Étape 5 : conformité

- Astérisque présent : `statut = NE_PAS_APPELER`, et on ne cherche pas d'autre numéro pour contourner l'astérisque.
- Opposition connue (liste interne des refus) : `NE_PAS_APPELER`.
- Chaque donnée personnelle a sa source dans la colonne `source_*` correspondante.

## Étape 6 : accroche et priorité

Pour chaque ligne :
- `accroche` : une phrase qui relie l'entreprise à une rubrique du dossier ;
- `officiel_a_citer` : l'officiel qui parle le plus à ce prospect ;
- `fait_source_url` : la source du fait cité. Sans source, pas de fait : l'accroche reste générique.
- `argument_1` et `argument_2` : pourquoi une parution a du sens pour eux (visibilité auprès des décideurs publics, chantier en cours, recrutement, anniversaire, etc.).
- `priorite` :
  - A : liste des officiels ou lien direct avec une rubrique ou un chantier ;
  - B : secteur ciblé, dans la zone ;
  - C : périphérique.
- `statut` initial : `A_APPELER`, ou `NE_PAS_APPELER`.

## Étape 7 : livraison

- Format : colonnes exactes de `templates/prospects.csv`.
- Destination : **Google Sheet**, via le connecteur Google Drive s'il est disponible. Sinon, un CSV dans `listings/`, qui est ignoré par Git. **Ne jamais commiter un listing.**
- Rapport final, en quelques lignes :
  - nombre d'entreprises par rubrique et par priorité ;
  - part avec dirigeant identifié ;
  - part avec portable, avec ligne directe, avec standard seul ;
  - nombre de numéros sous astérisque ;
  - crédits Apollo consommés ;
  - trous identifiés et sources à creuser.
