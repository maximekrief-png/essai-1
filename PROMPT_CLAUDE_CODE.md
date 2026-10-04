# Projet : application d'anglais pour Josh

## Contexte
Je suis le père de Josh, 15 ans, élève de seconde en France, en grande
difficulté en anglais. Je ne suis pas développeur : explique-moi chaque
étape d'installation et de mise en ligne pas à pas, en français, en
supposant que je n'ai jamais utilisé de terminal.

Objectif : une application qu'il utilise 20 minutes par jour, sur son PC
(Windows, navigateur Chrome ou Edge) et sur son iPhone, pour reconstruire
les bases de l'anglais, avec un suivi quotidien pour moi.

Critère de réussite mesurable : après 12 semaines, Josh a fait au moins
80 % des séances et son score au test de positionnement refait en fin de
cycle a progressé d'au moins un demi-niveau CECRL.

## Avant de coder
1. Pose-moi toutes tes questions en une seule fois (niveau supposé,
   modèle d'iPhone et version d'iOS, chapitres vus en classe, horaire de
   la séance, adresse e-mail pour le suivi, etc.).
2. Propose-moi un plan par phases, avec pour chaque phase ce que je
   pourrai tester moi-même, et attends ma validation.
3. Ensuite, exécute sans me solliciter à chaque étape, sauf pour les
   actions qui exigent mon intervention (création de comptes, clés).

## Architecture imposée
- PWA (React + Vite + TypeScript), mobile-first, installable sur iPhone
  (Safari > Partager > Sur l'écran d'accueil) et sur PC.
- Synchronisation de la progression entre appareils via Supabase
  (offre gratuite, région UE), avec règles de sécurité RLS.
- Deux vrais comptes Supabase distincts : élève (Josh) et parent (moi).
  Le compte parent lit toutes les données de Josh ; Josh ne peut ni lire
  ni modifier le suivi parent, ni réécrire son historique. Un simple code
  PIN côté navigateur ne suffit pas : il est contournable.
- Fonctionnement hors ligne : la séance reste faisable sans réseau
  (contenu et progression en IndexedDB), synchronisation au retour de la
  connexion, sans perte ni doublon si la séance a été commencée sur un
  appareil et reprise sur l'autre.
- Hébergement gratuit (Vercel ou Netlify), déploiement automatique depuis
  GitHub.
- Limites connues à traiter explicitement :
  - Supabase gratuit met le projet en pause après 7 jours sans activité
    (vacances) : prévois une solution (tâche planifiée qui le maintient
    actif) et documente la procédure de réactivation.
  - iOS : les notifications push d'une PWA ne fonctionnent qu'à partir
    d'iOS 16.4 et seulement si l'app est installée sur l'écran d'accueil.
  - Web Speech API : vérifie la disponibilité d'une voix en-GB sur iPhone
    et sur Windows ; repli propre si aucune voix britannique n'existe.
- Si tu vois une solution plus simple et aussi fiable, propose-la avant
  de commencer, avec ses inconvénients.

## Pédagogie
### Jour 1 : test de positionnement
15 à 20 minutes, adaptatif (on monte ou on descend en difficulté selon
les réponses), couvrant vocabulaire, conjugaison, grammaire,
compréhension orale et construction de phrase. Le résultat détermine le
point de départ et les notions à sauter ou à renforcer. Ne présume pas
qu'il part de zéro. Le même test (version parallèle) est refait en
semaine 6 et en semaine 12 pour mesurer la progression.

### Programme (niveau A1 vers A2+, 12 semaines pour commencer)
Le B1 en 12 semaines à 20 min/jour (environ 28 heures) n'est pas
réaliste pour un élève en grande difficulté ; vise un A2 solide.
- Vocabulaire : les 800 à 1 000 mots les plus fréquents, par thèmes
  proches de sa vie (école, famille, sport, loisirs, numérique), environ
  8 à 10 mots nouveaux par jour maximum.
- Conjugaison : be, have, présent simple, présent continu, prétérit,
  verbes irréguliers par lots de 5, futur (will / be going to), puis
  present perfect et modaux.
- Grammaire : pronoms, articles, possessifs, négation, questions,
  comparatifs, quantifieurs, prépositions, mots de liaison.
- Construction de phrase : ordre des mots, remise en ordre, traduction
  français vers anglais, phrases à compléter.
- Erreurs typiques des francophones : faux amis, "I am agree",
  "I have 15 years", "since/for", "-s" de la 3e personne, etc.
- Explications courtes (5 lignes max), en français, avec exemples.
  Ton adapté à un ado de 15 ans, jamais enfantin.
- Aligne si possible l'ordre des notions sur le programme de seconde
  (je te donnerai les chapitres vus en classe).

### Structure d'une séance de 20 minutes (temps actif)
1. Mini-évaluation des notions vues la veille (3 à 5 min, sans aide).
2. Révisions espacées (5 min, plafonnées : si trop de révisions sont
   dues, on priorise les plus anciennes en échec et on reporte le reste).
3. Nouvelle leçon et exercices (8 à 10 min) — remplacée par de la
   remédiation si l'évaluation de la veille est sous le seuil.
4. Bilan de la séance (1 à 2 min).
La séance ne doit jamais dépasser 25 minutes, même après plusieurs jours
manqués.

### Règles d'évaluation et de révision
- Chaque nouvelle notion est évaluée le lendemain.
- Seuil de maîtrise : 80 %. En dessous, remédiation ciblée (explication
  différente + exercices) puis nouvelle évaluation le jour suivant.
- Après 2 échecs consécutifs sur la même notion : on avance quand même,
  la notion est marquée "fragile", remise en révision fréquente et
  signalée dans le suivi parent. Pas de blocage infini.
- Répétition espacée par item (mot, forme verbale, règle) :
  J+1, J+3, J+7, J+14, J+30. Une erreur fait repartir l'item à J+1.
- S'il manque un jour, la séance suivante commence par l'évaluation due.
- Ces règles sont centralisées dans un seul module paramétrable.

### Types d'exercices
- Priorité aux réponses tapées (traduction, conjugaison, phrase à
  compléter). Les QCM restent minoritaires (20 % max).
- Remise en ordre de mots, association, dictée.
- Audio via la synthèse vocale du navigateur : écoute de chaque mot et
  phrase, exercices de compréhension orale.
- Correction : tolérance sur majuscules, ponctuation finale, espaces
  superflus et formes contractées/développées (I'm = I am) ; pas de
  tolérance sur l'orthographe. Après chaque erreur, afficher la bonne
  réponse, la règle, et faire retaper la bonne réponse.
- Clavier iPhone : désactiver correction automatique et majuscule auto
  sur les champs de réponse.

## Garde-fous contre la triche
- Le chrono ne compte que le temps actif (pause après 60 s
  d'inactivité ou si l'app passe en arrière-plan).
- Impossible de passer un exercice sans répondre.
- Détection des réponses enchaînées trop vite ; signalement dans le
  suivi parent.
- Côté Josh, ces mécanismes restent discrets : pas de messages
  accusateurs. L'objectif est la régularité, pas la surveillance.

## Suivi parent (tableau de bord)
Pour chaque jour : séance faite ou non, temps actif réel, score,
notions nouvelles, résultat de l'évaluation de la veille, notions en
échec, alertes de triche.
Vue d'ensemble : série de jours consécutifs, progression dans le
programme, points faibles récurrents, évolution des scores, résultats
des tests de positionnement successifs.
Un seul écran lisible en 30 secondes sur iPhone.
Phase 2 : résumé quotidien par e-mail (service gratuit type Resend,
déclenché par une tâche planifiée Supabase).

## Motivation
Série de jours (avec 1 "joker" par semaine pour ne pas tout perdre sur
un oubli), barre de progression, objectifs hebdomadaires. Sobre, sans
gadget. Josh voit sa propre progression (scores qui montent), pas
seulement ses erreurs.

## Contenu
- Stocké dans des fichiers JSON séparés du code, avec un schéma validé
  automatiquement (un fichier mal formé fait échouer les tests).
- Anglais britannique cohérent partout.
- Relis tout le contenu généré : zéro faute d'anglais, zéro réponse
  ambiguë. Prévois plusieurs réponses acceptées quand c'est légitime.
  Fais une seconde passe de relecture dédiée uniquement à cela et liste
  les items douteux pour que je les vérifie.

## Données personnelles
Josh est mineur : collecte minimale (prénom, progression), pas de
traceur ni d'analytics tiers, données hébergées en UE, possibilité de
tout exporter et tout supprimer depuis le compte parent.

## Livraison
- Phase 1 : test de positionnement, deux premières semaines de contenu,
  moteur de séance, suivi parent, synchronisation, mode hors ligne.
  Mise en ligne et test sur iPhone et sur PC.
- Phase 2 : reste du programme, e-mail quotidien, notifications de
  rappel, tests de positionnement des semaines 6 et 12.
- Tests automatisés : moteur de révision espacée, notation (tolérances),
  plafonnement de séance, synchronisation hors ligne, validation des
  JSON de contenu.
- Un README en français : installation sur iPhone et PC, création des
  comptes, ajout ou correction de contenu, que faire si Supabase est en
  pause, coût attendu (doit rester 0 €).
