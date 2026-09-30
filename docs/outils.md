# Outils proposés

Principe : **partir de ce qui existe déjà** (Google Sheet, Google Agenda, Apollo, ElevenLabs), puis n'ajouter un outil que s'il supprime une tâche manuelle mesurable. Le budget est à chiffrer dans un second temps.

| Besoin | Recommandé | Pourquoi | Alternative |
|---|---|---|---|
| CRM / listing | **Google Sheet existant** « Outil_Prospection_Swiss_Label » | 2 297 fiches, historique des parutions et du CA, déjà utilisé au quotidien | Nextlead (démo du 23.09) : uniquement s'il apporte numérotation et agenda intégrés. Migrer en pleine campagne est un risque |
| Recherche et enrichissement | **Claude Code** + skill `ciblage-sommaire` + **Apollo** (existant) + Zefix, search.ch / local.ch, SIMAP | Seul Apollo coûte (crédits). Zefix donne les dirigeants inscrits au registre du commerce. search.ch / local.ch donnent les numéros et l'astérisque | Moneyhouse (payant) |
| Agenda de Marc | **Google Agenda** (existant) + **Apps Script** + service Maps | Gratuit, sans serveur, lit les ajouts manuels (voir `planning.md`) | Google Routes API, pour le trafic en temps réel (payant à l'usage) |
| Poste d'appel (copilote) | **Barre latérale Apps Script** dans le Sheet : fiche du prospect, accroche selon la source, boutons de statut, créneaux proposés, clic pour appeler | Gratuit ; tout reste dans le Sheet | Ringover ou Aircall : numérotation enchaînée, numéro suisse affiché, enregistrement avec annonce |
| Amélioration du script | Ton outil de transcription actuel + une revue hebdomadaire avec Claude | La déballe s'améliore sur des données réelles | — |
| Agent vocal (phase 4) | **ElevenLabs Agents** (compte et voix existants) + **numéro fixe suisse** fourni par un opérateur SIP (peoplefone par exemple) ou par Twilio + outils branchés sur l'agenda et le Sheet | Déjà en place côté voix | Retell AI, Vapi |
| Automatisations | Apps Script d'abord ; **Zapier** (déjà connecté) si besoin | Moins de pièces à maintenir | Make, n8n |

## Téléphonie : ce qui se branche sur ElevenLabs (vérifié le 30.09.2026)

- **Twilio** : un opérateur « en ligne ». Il loue des numéros et relie le réseau téléphonique à un logiciel. Chez ElevenLabs, c'est le tuyau entre la ligne et l'agent. Ses numéros **mobiles** suisses sont réservés aux SMS. Ses numéros fixes suisses demandent un dossier réglementaire (extrait du registre du commerce, adresse en Suisse).
- **Ringover** : il n'a pas de trunk SIP bidirectionnel. Son module Connectivity sait seulement renvoyer un appel reçu sur Ringover vers un agent externe comme ElevenLabs. C'est utile pour les rappels entrants, pas pour qu'un agent appelle. Il propose aussi son propre agent d'accueil (AIRO).
- **Aircall** : aucune intégration documentée avec ElevenLabs n'a été trouvée.
- **Trunk SIP** : ElevenLabs accepte n'importe quel trunk SIP (Telnyx, Bandwidth, DIDWW, ou un opérateur suisse comme peoplefone).

## Agent vocal : périmètre défendable

On commence par les appels où la personne a déjà dit oui, ou par les appels entrants :

- confirmation des RDV la veille (moins de lapins, adresse vérifiée) ;
- rappels entrants (« vous rappelez Jacques Dupraz… ») : prise de message, ou RDV à partir des créneaux calculés.

Garde-fous (voir `CLAUDE.md`) :

- l'agent ne nie jamais être une IA ;
- il se présente comme l'assistant de l'équipe, pas comme Jacques Dupraz ;
- il annonce l'enregistrement ;
- il appelle depuis un numéro affiché et inscrit à l'annuaire.

La prospection à froid par l'agent n'est envisagée qu'après un avis juridique écrit (LCD art. 3 al. 1 let. o) et l'accord des partenaires officiels.
