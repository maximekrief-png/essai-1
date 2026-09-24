# Outil de prospection : Swiss Knowhow Magazine

Outil de prospection pour COM Consulting. Il part du sommaire d'un dossier et va jusqu'aux RDV de Marc Krief dans son agenda.

Contexte et règles : voir [`CLAUDE.md`](CLAUDE.md).

## Architecture cible

```
Sommaire ─▶ Carte de ciblage ─▶ Listing ─▶ Enrichissement ─▶ Google Sheet
             (validée)          (officiels, SIMAP,  (dirigeant, tel,       │
                                 RC, Apollo, web)    astérisque, accroche) ▼
                                                                  Poste d'appel
                                                                  (copilote)
                                                                        │
                                              Google Calendar de Marc ◀─┘
                                              (source de vérité, trajets optimisés)
```

- **Google Sheet** : c'est le CRM. Une ligne par entreprise, avec les colonnes de `templates/prospects.csv`.
- **Google Calendar de Marc** : c'est la seule source de vérité pour l'agenda. L'outil le relit à chaque proposition de créneau. Un RDV ajouté à la main est donc pris en compte sans synchronisation.

## Feuille de route

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Cadrage, garde-fous, schéma du listing, skill `ciblage-sommaire` | fait |
| 1 | Test du ciblage sur un vrai sommaire. Mesures : nombre d'entreprises, % de dirigeants identifiés, % portable ou ligne directe, crédits consommés | attend un sommaire |
| 2 | Moteur d'agenda : pour une adresse de prospect, proposer 2 à 3 créneaux qui minimisent les trajets de Marc, en tenant compte des RDV existants | attend les contraintes de Marc |
| 3 | Copilote d'appel : fiche prospect, déballe adaptée, numérotation enchaînée, saisie du résultat en un clic, créneaux proposés en direct | à cadrer |
| 4 | Agent vocal : d'abord les confirmations et rappels de RDV déjà pris, avec transparence. La prospection à froid n'est envisagée qu'après un avis juridique écrit (LCD) et l'accord des partenaires officiels | conditionnel |

## Utilisation

Dans une session Claude Code sur ce dépôt, coller le sommaire d'un dossier. Le skill `ciblage-sommaire` déroule la procédure et s'arrête pour faire valider la carte de ciblage avant toute recherche.
