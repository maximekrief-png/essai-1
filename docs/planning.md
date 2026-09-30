# Agenda de Marc : protocole et moteur de créneaux

## Constat : semaine du 28 septembre 2026

- 14 RDV physiques du 28 au 30.09, dont **8 le mardi 29**. Plus 3 RDV les 23 et 24.09.
- **Mardi 29, deux trajets vers Marin le même jour** : un RDV à 10h, un autre à 17h30. Au moment de fixer le second, l'outil aurait proposé un créneau collé au premier.
- **Des rappels téléphoniques dans le calendrier RDV** (lundi 28, 13h et 13h15). Ils brouillent la lecture et faussent le calcul des trajets.
- **Un RDV en double** : il figure au 01.10 à 10h dans « Rappels téléphoniques » et au 05.10 à 15h30 à Renens (VD) dans « RENDEZ VOUS MARC KRIEF ». Il faut trancher.
- **Des RDV sans adresse exploitable** : « rdv horlogerie » n'a pas de lieu, et « hotel beau rivage » n'est pas une adresse complète.

## Règles des deux calendriers

- **RENDEZ VOUS MARC KRIEF** : uniquement des RDV physiques de Marc, et des bornes de semaine. Chaque événement a une **adresse complète** (rue, n°, localité).
- **Rappels téléphoniques Com Consulting** : tous les rappels et les appels à passer.

## Protocole du lundi (bornes de la semaine)

Le lundi qui précède une semaine de RDV, tu crées dans **RENDEZ VOUS MARC KRIEF** :

| Titre de l'événement | Heure | Lieu |
|---|---|---|
| `ARRIVÉE Marc` | heure d'arrivée | lieu d'arrivée (gare, domicile, bureau…) |
| `DÉPART Marc` | heure de départ | lieu de départ |
| `NUIT Marc` (facultatif, un par soir) | le soir | lieu où il dort, qui sert de point de départ et d'arrivée de chaque journée |

Le moteur lit ces événements directement dans le calendrier : pas de fichier de paramètres à tenir à jour. Pour la même raison, un RDV ajouté à la main par Marc ou par toi est pris en compte au calcul suivant.

## Paramètres par défaut

Ils sont déduits des RDV existants ; à confirmer.

- Bloc RDV : **30 min** (15 à 20 min de présentation, plus la marge).
- Tampon entre deux RDV : **10 min**, en plus du trajet.
- Plage de travail : **8h00 à 18h30**.
- Mode de déplacement : **voiture**. Couvet, La Sagne et Les Geneveys-sur-Coffrane dans la même journée, c'est difficile en transports publics.
- Maximum : **8 RDV par jour**, comme le mardi 29.

## Algorithme : proposer 2 à 3 créneaux pour un prospect

Entrée : l'adresse du prospect P et la semaine visée.

1. Lire les événements de la semaine dans RENDEZ VOUS MARC KRIEF (RDV, `ARRIVÉE`, `DÉPART`, `NUIT`).
2. Pour chaque jour compris entre ARRIVÉE et DÉPART, construire la séquence des étapes fixes : point de départ du jour, puis les RDV, puis le point d'arrivée du jour.
3. Pour chaque trou entre deux étapes A et B, tester les heures de début t (par pas de 15 min) qui vérifient :
   - `t ≥ fin(A) + trajet(A→P) + tampon`
   - `t + 30 min ≤ début(B) − trajet(P→B) − tampon`
4. Calculer le **coût** d'un créneau : `trajet(A→P) + trajet(P→B) − trajet(A→B)`, c'est-à-dire le détour ajouté.
5. Trier par coût croissant. Proposer si possible deux jours différents, ou un matin et un après-midi.
6. Contrôles au passage :
   - chevauchements entre RDV ;
   - enchaînements impossibles vu le trajet ;
   - RDV sans adresse.

Sortie, par exemple : « Mardi 10h45 (+6 min de trajet) · Mercredi 8h00 (+9 min) ».

## Mise en œuvre recommandée

Un **Google Apps Script** rattaché au Google Sheet « Outil_Prospection_Swiss_Label » :

- un menu **Agenda → Proposer des créneaux** qui travaille sur la ligne sélectionnée ;
- le service Maps d'Apps Script pour le géocodage et le temps de trajet en voiture ;
- aucun serveur, et gratuit dans la limite des quotas Google ;
- plus tard, le même code exposé en web app, pour que l'agent vocal puisse l'appeler comme un outil.

## Questions ouvertes

1. Marc se déplace en voiture ou en train ?
2. Où dort-il pendant les semaines de RDV ? Rentre-t-il chaque soir à La Chaux-de-Fonds ?
3. Une pause déjeuner est-elle imposée ?
4. Quel maximum de RDV par jour souhaite-t-il vraiment ?
