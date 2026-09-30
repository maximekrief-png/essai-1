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
| 0 | Cadrage, garde-fous, skill `ciblage-sommaire`, script d'appel (`docs/script-appel.md`), outils (`docs/outils.md`) | fait |
| 1 | Neuchâtel : 63 fiches enrichies et écrites dans le Sheet le 30.09 (colonne Adresse ajoutée) ; 42 à relancer ; portables Apollo à valider ; puis Genève (226 fiches sans numéro) | en cours |
| 2 | Moteur d'agenda (Apps Script) : pour une adresse de prospect, proposer 3 créneaux qui minimisent les trajets de Marc, entre les bornes ARRIVÉE et DÉPART (`apps-script/`) | fait, à installer |
| 3 | Copilote d'appel : barre latérale dans le Sheet avec fiche, accroche selon la source, statut en un clic et créneaux proposés | à cadrer |
| 4 | Agent vocal : d'abord les confirmations et rappels de RDV déjà pris, avec transparence. La prospection à froid n'est envisagée qu'après un avis juridique écrit (LCD) et l'accord des partenaires officiels | conditionnel |

## Utilisation

Dans une session Claude Code sur ce dépôt, coller le sommaire d'un dossier. Le skill `ciblage-sommaire` déroule la procédure et s'arrête pour faire valider la carte de ciblage avant toute recherche.
