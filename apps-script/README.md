# Moteur d'agenda (Google Apps Script)

Ce script ajoute un menu **Agenda** au Google Sheet « Outil_Prospection_Swiss_Label » :

- **Proposer des créneaux (ligne sélectionnée)** : 3 créneaux pour l'entreprise de la ligne, avec le détour ajouté en voiture. Un bouton **Réserver** crée le RDV dans « RENDEZ VOUS MARC KRIEF » et passe la fiche en `RDV OK`.
- **Vérifier les semaines à venir** : signale les chevauchements, les enchaînements trop serrés, les RDV sans adresse, les rappels égarés dans le calendrier RDV et les jours de plus de 10 RDV. Il conseille aussi un hôtel pour chaque nuit.

## Installation (une fois, 5 minutes)

1. Ouvrir le Google Sheet, puis **Extensions → Apps Script**.
2. Remplacer le contenu de `Code.gs` par celui de `Agenda.gs`, puis enregistrer.
3. Dans **Paramètres du projet**, choisir le fuseau horaire `Europe/Zurich`.
4. Recharger le Google Sheet : le menu **Agenda** apparaît.
5. Au premier clic, Google demande l'autorisation d'accéder à l'agenda, au Sheet et à Maps : accepter.

## Utilisation

- **Le lundi précédant une semaine de RDV**, créer dans « RENDEZ VOUS MARC KRIEF » :
  - `ARRIVÉE Marc` : l'heure de fin de l'événement est l'heure à partir de laquelle Marc est disponible ; le lieu est l'endroit où il arrive ;
  - `DÉPART Marc` : l'heure de début de l'événement est l'heure à laquelle il doit partir ; le lieu est l'endroit d'où il part.
- **Pendant l'appel** : sélectionner la ligne du prospect, puis **Agenda → Proposer des créneaux**.
  - S'il n'y a pas de colonne `Adresse`, le script demande l'adresse.
  - Laissée vide, l'adresse devient « Entreprise, Ville », que Google Maps trouve en général.
- **Les RDV ajoutés à la main** sont pris en compte au calcul suivant, sans rien faire de plus.
- Les semaines sans `ARRIVÉE` / `DÉPART` sont proposées en dernier, marquées « semaine sans ARRIVÉE / DÉPART ».

## Règles de calcul

Tous ces paramètres sont modifiables dans `PARAMS`, en haut du script.

| Paramètre | Valeur |
|---|---|
| Déplacement | voiture (Google Maps, sans trafic en temps réel) |
| Durée d'un RDV | 30 min, présentation et marge comprises |
| Marge entre deux RDV | 10 min, en plus du trajet |
| Plage horaire | 8h00 – 18h30, du lundi au vendredi |
| Maximum | 10 RDV par jour |
| Nuits | hôtel près du dernier RDV du soir si le premier RDV du lendemain est à 25 min ou moins ; sinon hôtel près du premier RDV du lendemain |

Classement des créneaux : d'abord les séjours confirmés (ARRIVÉE / DÉPART), puis le plus petit détour, en variant les jours et les demi-journées.

## Tests

```bash
TZ=Europe/Zurich node --test apps-script/test/agenda.test.js
```

Le cœur du calcul n'utilise aucun service Google : il est testé sous Node avec des temps de trajet fictifs.
