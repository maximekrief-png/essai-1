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

Pas besoin d'indiquer l'hôtel : le moteur le conseille à partir des RDV (voir « Vérifier les semaines à venir »). Le moteur lit ces événements directement dans le calendrier : pas de fichier de paramètres à tenir à jour. Pour la même raison, un RDV ajouté à la main par Marc ou par toi est pris en compte au calcul suivant.

## Paramètres (validés le 30.09)

- Bloc RDV : **30 min** (15 à 20 min de présentation, plus la marge).
- Tampon entre deux RDV : **10 min**, en plus du trajet.
- Plage de travail : **8h00 à 18h30**, du lundi au vendredi.
- Mode de déplacement : **voiture**.
- Maximum : **10 RDV par jour**.
- **Nuits à l'hôtel, choisies selon le dernier RDV du soir et le premier du lendemain.** Si le trajet entre les deux dépasse 25 min, l'hôtel est près du premier RDV du lendemain (Marc fait la route la veille) ; sinon, il est près du dernier RDV.
- Pause déjeuner : non imposée (à ajouter dans `PARAMS` si besoin).

## Algorithme : proposer 2 à 3 créneaux pour un prospect

Entrée : l'adresse du prospect P et la semaine visée.

1. Lire les événements dans RENDEZ VOUS MARC KRIEF (RDV, `ARRIVÉE`, `DÉPART`). Les rappels téléphoniques sont ignorés.
2. Pour chaque jour compris entre ARRIVÉE et DÉPART, construire la séquence des étapes : l'arrivée ou le dernier RDV de la veille (nuit à l'hôtel, sans contrainte horaire), puis les RDV du jour, puis le départ ou le premier RDV du lendemain.
3. Pour chaque trou entre deux étapes A et B, tester les heures de début t (par pas de 15 min) qui vérifient :
   - `t ≥ fin(A) + trajet(A→P) + tampon`
   - `t + 30 min ≤ début(B) − trajet(P→B) − tampon`
4. Calculer le **coût** d'un créneau : `trajet(A→P) + trajet(P→B) − trajet(A→B)`, c'est-à-dire le détour ajouté.
5. Trier : d'abord les séjours confirmés (ARRIVÉE / DÉPART), puis le coût croissant. Proposer si possible deux jours différents, ou un matin et un après-midi. Les semaines sans bornes passent en dernier.
6. Contrôles au passage :
   - chevauchements entre RDV ;
   - enchaînements impossibles vu le trajet ;
   - RDV sans adresse.

Sortie, par exemple : « Mardi 10h45 (+6 min de trajet) · Mercredi 8h00 (+9 min) ».

## Mise en œuvre

C'est fait : `apps-script/Agenda.gs`, un Google Apps Script rattaché au Google Sheet (installation : `apps-script/README.md`).

- Menu **Agenda → Proposer des créneaux** sur la ligne sélectionnée, et bouton **Réserver**.
- Menu **Agenda → Vérifier les semaines à venir**, avec les conseils d'hôtel.
- Le service Maps d'Apps Script calcule les trajets en voiture ; ils restent en cache 6 h.
- Aucun serveur, et gratuit dans la limite des quotas Google.
- Plus tard, le même cœur pourra être exposé en web app pour l'agent vocal.

## Question ouverte

- Une pause déjeuner doit-elle être bloquée ?
