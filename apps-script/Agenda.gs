/**
 * Agenda de Marc : moteur de créneaux (Google Apps Script lié au Google Sheet de prospection).
 *
 * - Lit le calendrier « RENDEZ VOUS MARC KRIEF » à chaque calcul : un RDV ajouté à la main
 *   est donc toujours pris en compte.
 * - Les bornes de la semaine sont des événements « ARRIVÉE Marc » et « DÉPART Marc »
 *   (heure + lieu), créés le lundi précédent.
 * - Marc dort à l'hôtel : la nuit n'impose pas de point de départ fixe, le trajet entre le
 *   dernier RDV du soir et le premier du lendemain compte comme un détour ordinaire.
 *
 * Le cœur (fonctions sans « _ » final) n'utilise aucun service Google : il est testé sous
 * Node (apps-script/test/agenda.test.js). Les fonctions « _ » et les menus appellent
 * CalendarApp, Maps, CacheService, SpreadsheetApp et HtmlService.
 */

var PARAMS = {
  calendrierRdv: 'RENDEZ VOUS MARC KRIEF',
  feuille: 'PROSPECTION',
  ligneEntetes: 2,
  rdvMin: 30,            // 15-20 min de présentation + marge
  tamponMin: 10,         // en plus du trajet entre deux RDV
  pasMin: 15,            // grille des heures proposées
  debutJour: '08:00',
  finJour: '18:30',
  heureJourVide: '09:00', // heure proposée par défaut sur un jour sans RDV
  maxRdvJour: 10,
  joursOuvres: [1, 2, 3, 4, 5], // lundi..vendredi
  delaiMinMinutes: 60,   // pas de créneau dans l'heure qui vient
  nbPropositions: 3,
  horizonJours: 28,
  seuilHotelMin: 25      // au-delà, hôtel près du premier RDV du lendemain
};

var JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

function normaliser(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

/** ARRIVEE, DEPART, AUTRE (rappel téléphonique égaré dans le calendrier RDV) ou RDV. */
function typeEvenement(titre) {
  var t = normaliser(titre);
  if (/^[^A-Z0-9]*ARRIVEE\b/.test(t)) return 'ARRIVEE';
  if (/^[^A-Z0-9]*DEPART\b/.test(t)) return 'DEPART';
  if (/^[^A-Z0-9]*(APPELER|RAPPEL)\b/.test(t)) return 'AUTRE';
  return 'RDV';
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function ajouterMinutes(d, m) { return new Date(d.getTime() + m * 60000); }
function cleJour(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function debutDuJour(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function jourSuivant(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }

function aHeure(jour, hhmm) {
  var p = hhmm.split(':');
  return new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), Number(p[0]), Number(p[1]));
}

function arrondirHaut(d, pasMin) { var ms = pasMin * 60000; return new Date(Math.ceil(d.getTime() / ms) * ms); }
function arrondirBas(d, pasMin) { var ms = pasMin * 60000; return new Date(Math.floor(d.getTime() / ms) * ms); }
function parDebut(a, b) { return a.debut - b.debut; }

function formatFr(d) {
  return JOURS_FR[d.getDay()] + ' ' + pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) +
    ' à ' + pad2(d.getHours()) + 'h' + pad2(d.getMinutes());
}

/** « Route de Boudry 26\nCortaillod, Suisse » -> « Cortaillod ». */
function localite(lieu) {
  if (!lieu) return '';
  var parts = String(lieu).split(/\n|,/).map(function (s) { return s.trim(); }).filter(Boolean)
    .filter(function (p) { return !/^(suisse|switzerland|schweiz|svizzera|ch)$/i.test(p); });
  var dernier = parts.length ? parts[parts.length - 1] : '';
  return dernier.replace(/^\d{4}\s+/, '').replace(/\s+(NE|VD|GE|JU|FR|BE|VS)$/, '').trim();
}

function demiJournee(d) { return cleJour(d) + (d.getHours() < 12 ? 'AM' : 'PM'); }

// ---------------------------------------------------------------------------
// Séjours : de « ARRIVÉE » à « DÉPART », ou semaine implicite sans bornes
// ---------------------------------------------------------------------------

function construireSejours(evenements, params, maintenant) {
  var evs = evenements.slice().sort(parDebut);
  var sejours = [];
  var horsSejour = [];
  var courant = null;
  evs.forEach(function (e) {
    if (e.type === 'ARRIVEE') {
      if (courant) sejours.push(courant);
      courant = { arrivee: e, depart: null, rdvs: [], autres: [], implicite: false };
    } else if (e.type === 'DEPART') {
      if (courant) { courant.depart = e; sejours.push(courant); courant = null; }
    } else if (courant) {
      (e.type === 'RDV' ? courant.rdvs : courant.autres).push(e);
    } else {
      horsSejour.push(e);
    }
  });
  if (courant) sejours.push(courant);

  // Semaines de l'horizon sans bornes : séjour implicite du lundi matin au vendredi soir.
  var lundi = debutDuJour(maintenant);
  while (lundi.getDay() !== 1) lundi = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() - 1);
  var finHorizon = ajouterMinutes(maintenant, params.horizonJours * 24 * 60);
  for (; lundi < finHorizon; lundi = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 7)) {
    var debutS = aHeure(lundi, params.debutJour);
    var vendredi = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 4);
    var finS = aHeure(vendredi, params.finJour);
    var couverte = sejours.some(function (s) {
      var a = s.arrivee.debut;
      var b = s.depart ? s.depart.debut : ajouterMinutes(a, 7 * 24 * 60);
      return a <= finS && b >= debutS;
    });
    if (couverte) continue;
    var dedans = horsSejour.filter(function (e) { return e.debut >= debutS && e.debut <= finS; });
    sejours.push({
      arrivee: { titre: 'Début de semaine', debut: debutS, fin: debutS, lieu: null },
      depart: { titre: 'Fin de semaine', debut: finS, fin: finS, lieu: null },
      rdvs: dedans.filter(function (e) { return e.type === 'RDV'; }),
      autres: dedans.filter(function (e) { return e.type !== 'RDV'; }),
      implicite: true
    });
  }
  return sejours.sort(function (a, b) { return a.arrivee.debut - b.arrivee.debut; });
}

function finSejour(sejour, params) {
  if (sejour.depart) return sejour.depart.debut;
  var dernier = sejour.rdvs.length ? sejour.rdvs[sejour.rdvs.length - 1].fin : sejour.arrivee.debut;
  var j = debutDuJour(dernier);
  while (j.getDay() !== 5) j = jourSuivant(j); // jusqu'au vendredi
  return aHeure(j, params.finJour);
}

// ---------------------------------------------------------------------------
// Proposition de créneaux
// ---------------------------------------------------------------------------

/**
 * trajet(a, b) -> minutes en voiture, 0 si un lieu manque, null si aucun itinéraire.
 * Renvoie { propositions: [...], alertes: [...] }.
 */
function proposerCreneaux(evenements, lieuProspect, params, trajet, maintenant) {
  var sejours = construireSejours(evenements, params, maintenant);
  var candidats = [];
  var alertes = [];
  sejours.forEach(function (s) {
    candidats = candidats.concat(candidatsSejour(s, lieuProspect, params, trajet, maintenant, alertes));
  });
  return { propositions: choisir(candidats, params.nbPropositions), alertes: alertes };
}

function candidatsSejour(sejour, lieuP, params, trajet, maintenant, alertes) {
  var res = [];
  var arriveeT = sejour.arrivee.fin || sejour.arrivee.debut;
  var departT = finSejour(sejour, params);
  var rdvs = sejour.rdvs.slice().sort(parDebut);
  var auPlusTot = ajouterMinutes(maintenant, params.delaiMinMinutes);

  for (var jour = debutDuJour(arriveeT); jour <= departT; jour = jourSuivant(jour)) {
    if (params.joursOuvres.indexOf(jour.getDay()) < 0) continue;
    var cle = cleJour(jour);
    var jourArrivee = cle === cleJour(arriveeT);
    var jourDepart = cle === cleJour(departT);

    var w0 = new Date(Math.max(aHeure(jour, params.debutJour), auPlusTot, jourArrivee ? arriveeT : 0));
    var w1 = new Date(Math.min(aHeure(jour, params.finJour), jourDepart ? departT : Infinity));
    if (w1 - w0 < params.rdvMin * 60000) continue;

    var duJour = rdvs.filter(function (e) { return cleJour(e.debut) === cle; });
    if (duJour.length >= params.maxRdvJour) continue;

    // Étape précédente : l'arrivée (même jour) ou le dernier RDV avant ce jour (nuit à l'hôtel).
    var avant = rdvs.filter(function (e) { return e.debut < debutDuJour(jour); });
    var prec = jourArrivee
      ? { titre: sejour.arrivee.titre, lieu: sejour.arrivee.lieu, fin: arriveeT, memeJour: true }
      : { titre: avant.length ? avant[avant.length - 1].titre : sejour.arrivee.titre,
          lieu: avant.length ? avant[avant.length - 1].lieu : sejour.arrivee.lieu, memeJour: false };
    // Étape suivante : le départ (même jour) ou le premier RDV après ce jour.
    var apres = rdvs.filter(function (e) { return e.debut >= jourSuivant(jour); });
    var suiv = jourDepart
      ? { titre: sejour.depart ? sejour.depart.titre : '', lieu: sejour.depart ? sejour.depart.lieu : null, debut: departT, memeJour: true }
      : { titre: apres.length ? apres[0].titre : (sejour.depart ? sejour.depart.titre : ''),
          lieu: apres.length ? apres[0].lieu : (sejour.depart ? sejour.depart.lieu : null), memeJour: false };

    var etapes = [prec].concat(duJour.map(function (e) {
      return { titre: e.titre, lieu: e.lieu, debut: e.debut, fin: e.fin, memeJour: true };
    })).concat([suiv]);

    for (var i = 0; i < etapes.length - 1; i++) {
      var a = etapes[i], b = etapes[i + 1];
      var tAP = trajet(a.lieu, lieuP), tPB = trajet(lieuP, b.lieu), tAB = trajet(a.lieu, b.lieu);
      if (tAP === null || tPB === null || tAB === null) {
        alertes.push('Itinéraire introuvable autour de « ' + (a.titre || '') + ' » / « ' + (b.titre || '') + ' ».');
        continue;
      }
      var tot = w0;
      if (a.memeJour) tot = new Date(Math.max(tot, ajouterMinutes(a.fin, tAP + params.tamponMin)));
      var tard = ajouterMinutes(w1, -params.rdvMin);
      if (b.memeJour) tard = new Date(Math.min(tard, ajouterMinutes(b.debut, -(tPB + params.tamponMin + params.rdvMin))));
      tot = arrondirHaut(tot, params.pasMin);
      tard = arrondirBas(tard, params.pasMin);
      if (tot > tard) continue;

      var debut;
      if (a.memeJour) debut = tot;            // collé au RDV précédent
      else if (b.memeJour) debut = tard;      // collé au RDV suivant
      else {                                  // jour sans RDV
        var pref = aHeure(jour, params.heureJourVide);
        debut = new Date(Math.min(Math.max(pref, tot), tard));
      }
      res.push({
        debut: debut,
        fin: ajouterMinutes(debut, params.rdvMin),
        // Sans aucun lieu autour (semaine sans bornes ni RDV), le détour est inconnu.
        detourMin: (a.lieu || b.lieu) ? tAP + tPB - tAB : null,
        avant: a.titre || '',
        apres: b.titre || '',
        implicite: sejour.implicite
      });
    }
  }
  return res;
}

/**
 * Séjours confirmés (ARRIVÉE / DÉPART) avant les semaines sans bornes, puis plus petit détour,
 * en variant les jours puis les demi-journées.
 */
function choisir(candidats, n) {
  function rang(c) { return (c.implicite ? 2 : 0) + (c.detourMin === null ? 1 : 0); }
  var tries = candidats.slice().sort(function (a, b) {
    return rang(a) - rang(b) || (a.detourMin || 0) - (b.detourMin || 0) || a.debut - b.debut;
  });
  var choisis = [];
  var passes = [
    function (c) { return !choisis.some(function (x) { return cleJour(x.debut) === cleJour(c.debut); }); },
    function (c) { return !choisis.some(function (x) { return demiJournee(x.debut) === demiJournee(c.debut); }); },
    function (c) { return !choisis.some(function (x) { return x.debut < c.fin && c.debut < x.fin; }); }
  ];
  passes.forEach(function (ok) {
    tries.forEach(function (c) {
      if (choisis.length < n && choisis.indexOf(c) < 0 && ok(c)) choisis.push(c);
    });
  });
  return choisis;
}

// ---------------------------------------------------------------------------
// Vérification des semaines et conseils d'hôtel
// ---------------------------------------------------------------------------

function verifierAgenda(evenements, params, trajet, maintenant) {
  var alertes = [];
  var nuits = [];
  construireSejours(evenements, params, maintenant).forEach(function (s) {
    if (s.implicite && !s.rdvs.length) return;
    var rdvs = s.rdvs.slice().sort(parDebut);
    var nom = s.implicite ? 'Semaine du ' + formatFr(s.arrivee.debut).replace(/ à .*/, '') + ' (sans ARRIVÉE / DÉPART)' :
      'Séjour du ' + formatFr(s.arrivee.debut);
    if (s.implicite) alertes.push(nom + ' : crée les événements « ARRIVÉE Marc » et « DÉPART Marc ».');
    if (!s.implicite && !s.depart) alertes.push(nom + ' : pas d\'événement « DÉPART Marc ».');

    s.autres.forEach(function (e) {
      alertes.push('« ' + e.titre + ' » (' + formatFr(e.debut) + ') est un rappel : à déplacer dans le calendrier des rappels.');
    });
    rdvs.forEach(function (e) {
      if (!e.lieu) alertes.push('« ' + e.titre + ' » (' + formatFr(e.debut) + ') n\'a pas d\'adresse : trajets non calculés.');
    });

    var parJour = {};
    rdvs.forEach(function (e) { (parJour[cleJour(e.debut)] = parJour[cleJour(e.debut)] || []).push(e); });
    Object.keys(parJour).forEach(function (k) {
      if (parJour[k].length > params.maxRdvJour) {
        alertes.push(formatFr(parJour[k][0].debut).replace(/ à .*/, '') + ' : ' + parJour[k].length +
          ' RDV (maximum ' + params.maxRdvJour + ').');
      }
    });

    // Enchaînements du même jour, arrivée et départ compris.
    var etapes = [];
    if (!s.implicite) etapes.push({ titre: s.arrivee.titre, lieu: s.arrivee.lieu, debut: s.arrivee.debut, fin: s.arrivee.fin || s.arrivee.debut });
    etapes = etapes.concat(rdvs);
    if (!s.implicite && s.depart) etapes.push(s.depart);
    for (var i = 0; i < etapes.length - 1; i++) {
      var a = etapes[i], b = etapes[i + 1];
      if (cleJour(a.debut) !== cleJour(b.debut)) continue;
      if (b.debut < a.fin) {
        alertes.push('Chevauchement : « ' + a.titre + ' » et « ' + b.titre + ' » (' + formatFr(b.debut) + ').');
        continue;
      }
      var t = trajet(a.lieu, b.lieu);
      if (t === null) { alertes.push('Itinéraire introuvable entre « ' + a.titre + ' » et « ' + b.titre + ' ».'); continue; }
      var dispo = (b.debut - a.fin) / 60000;
      if (dispo < t + params.tamponMin) {
        alertes.push('Enchaînement trop serré : « ' + a.titre + ' » (fin ' + formatFr(a.fin).replace(/.* à /, '') +
          ') → « ' + b.titre + ' » (' + formatFr(b.debut) + ') : ' + Math.round(dispo) + ' min pour ' + t +
          ' min de route + ' + params.tamponMin + ' min de marge.');
      }
    }

    // Nuits : entre le dernier RDV d'un jour et le premier du jour suivant qui a des RDV.
    var jours = Object.keys(parJour).sort();
    for (var j = 0; j < jours.length - 1; j++) {
      var dernier = parJour[jours[j]][parJour[jours[j]].length - 1];
      var premier = parJour[jours[j + 1]][0];
      var tn = trajet(dernier.lieu, premier.lieu);
      var loinDuPremier = tn !== null && tn > params.seuilHotelMin;
      var cible = loinDuPremier ? premier : dernier;
      nuits.push({
        nuit: formatFr(dernier.debut).replace(/ à .*/, ''),
        dernier: dernier.titre + ' (' + localite(dernier.lieu) + ', fin ' + formatFr(dernier.fin).replace(/.* à /, '') + ')',
        premier: premier.titre + ' (' + localite(premier.lieu) + ', ' + formatFr(premier.debut) + ')',
        trajetMin: tn,
        conseil: 'Hôtel à ' + (localite(cible.lieu) || '?') +
          (loinDuPremier ? ' (faire la route la veille au soir)' : ' (le matin, la route est courte)')
      });
    }
  });
  return { alertes: alertes, nuits: nuits };
}

// ---------------------------------------------------------------------------
// Fiche du Google Sheet
// ---------------------------------------------------------------------------

/** Premier bloc « Nom / Fonction / Portable… » = DIRIGEANT 1. */
function ficheDepuisLigne(entetes, valeurs) {
  function v(nom) { var i = entetes.indexOf(nom); return i < 0 ? '' : String(valeurs[i] || '').trim(); }
  return {
    id: v('ID'), entreprise: v('Entreprise'), ville: v('Ville'), adresse: v('Adresse'),
    dirigeant: v('Nom'), fonction: v('Fonction'), portable: v('Portable'), direct: v('Ligne directe'),
    standard: v('Standard'), projet: v('Projet à évoquer (Deicher)'), source: v('Donné par / source')
  };
}

function titreRdv(f) { return f.entreprise + (f.dirigeant ? ' – ' + f.dirigeant : ''); }

function descriptionRdv(f) {
  return [
    f.id ? 'Fiche ' + f.id : '',
    f.dirigeant ? 'Dirigeant : ' + f.dirigeant + (f.fonction ? ' – ' + f.fonction : '') : '',
    f.portable ? 'Portable : ' + f.portable : '',
    f.direct ? 'Ligne directe : ' + f.direct : '',
    f.standard ? 'Standard : ' + f.standard : '',
    f.projet ? 'À évoquer : ' + f.projet : '',
    f.source ? 'Source : ' + f.source : ''
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Services Google (Apps Script uniquement)
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Agenda')
    .addItem('Proposer des créneaux (ligne sélectionnée)', 'menuProposerCreneaux')
    .addItem('Vérifier les semaines à venir', 'menuVerifierAgenda')
    .addToUi();
}

function calendrierRdv_() {
  var cals = CalendarApp.getCalendarsByName(PARAMS.calendrierRdv);
  if (!cals.length) throw new Error('Calendrier introuvable : ' + PARAMS.calendrierRdv);
  return cals[0];
}

function lireEvenements_(maintenant) {
  var debut = ajouterMinutes(maintenant, -7 * 24 * 60);
  var fin = ajouterMinutes(maintenant, (PARAMS.horizonJours + 7) * 24 * 60);
  return calendrierRdv_().getEvents(debut, fin)
    .filter(function (e) { return !e.isAllDayEvent(); })
    .map(function (e) {
      return { titre: e.getTitle(), debut: e.getStartTime(), fin: e.getEndTime(),
               lieu: e.getLocation() || null, type: typeEvenement(e.getTitle()) };
    });
}

/** Minutes en voiture (Google Maps), mises en cache 6 h. */
function trajetMinutes_(a, b) {
  if (!a || !b) return 0;
  if (normaliser(a) === normaliser(b)) return 0;
  var cache = CacheService.getScriptCache();
  var cle = 'tr_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, normaliser(a) + '|' + normaliser(b)));
  var enCache = cache.get(cle);
  if (enCache !== null) return enCache === 'x' ? null : Number(enCache);
  var r = Maps.newDirectionFinder().setOrigin(a).setDestination(b)
    .setMode(Maps.DirectionFinder.Mode.DRIVING).setRegion('ch').setLanguage('fr').getDirections();
  var min = r && r.routes && r.routes.length ? Math.ceil(r.routes[0].legs[0].duration.value / 60) : null;
  cache.put(cle, min === null ? 'x' : String(min), 21600);
  return min;
}

function lireFiche_(feuille, ligne) {
  var entetes = feuille.getRange(PARAMS.ligneEntetes, 1, 1, feuille.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var valeurs = feuille.getRange(ligne, 1, 1, entetes.length).getValues()[0];
  return { entetes: entetes, fiche: ficheDepuisLigne(entetes, valeurs) };
}

function echapper_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function menuProposerCreneaux() {
  var ui = SpreadsheetApp.getUi();
  var feuille = SpreadsheetApp.getActiveSheet();
  if (feuille.getName() !== PARAMS.feuille) { ui.alert('Ouvre l\'onglet ' + PARAMS.feuille + '.'); return; }
  var ligne = feuille.getActiveRange().getRow();
  if (ligne <= PARAMS.ligneEntetes) { ui.alert('Sélectionne la ligne d\'une entreprise.'); return; }
  var fiche = lireFiche_(feuille, ligne).fiche;

  var adresse = fiche.adresse;
  if (!adresse) {
    var rep = ui.prompt('Adresse du RDV',
      'Adresse de ' + fiche.entreprise + ' (rue, n°, localité).\nVide = « ' + fiche.entreprise + ', ' + fiche.ville + ' ».',
      ui.ButtonSet.OK_CANCEL);
    if (rep.getSelectedButton() !== ui.Button.OK) return;
    adresse = rep.getResponseText().trim() || [fiche.entreprise, fiche.ville, 'Suisse'].filter(Boolean).join(', ');
  }

  var maintenant = new Date();
  var r = proposerCreneaux(lireEvenements_(maintenant), adresse, PARAMS, trajetMinutes_, maintenant);
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px">';
  html += '<p><b>' + echapper_(fiche.entreprise) + '</b><br>' + echapper_(adresse) + '</p>';
  if (!r.propositions.length) html += '<p>Aucun créneau libre dans les ' + PARAMS.horizonJours + ' prochains jours.</p>';
  r.propositions.forEach(function (p) {
    html += '<p style="margin:10px 0"><button onclick="reserver(' + p.debut.getTime() + ')">Réserver</button> ' +
      '<b>' + formatFr(p.debut) + '</b> · ' +
      (p.detourMin === null ? 'détour inconnu' : '+' + p.detourMin + ' min de route') +
      (p.implicite ? ' · <i>semaine sans ARRIVÉE / DÉPART</i>' : '') +
      '<br><small>entre « ' + echapper_(p.avant) + ' » et « ' + echapper_(p.apres) + ' »</small></p>';
  });
  r.alertes.forEach(function (a) { html += '<p style="color:#a33"><small>' + echapper_(a) + '</small></p>'; });
  html += '<p id="ok"></p></div><script>function reserver(ms){document.getElementById("ok").textContent="Réservation…";' +
    'google.script.run.withSuccessHandler(function(t){document.getElementById("ok").textContent="RDV créé : "+t;' +
    'setTimeout(google.script.host.close,1500);}).withFailureHandler(function(e){document.getElementById("ok").textContent=e.message;})' +
    '.reserverCreneau(' + ligne + ',ms,' + JSON.stringify(adresse) + ');}</script>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(360), 'Créneaux proposés');
}

function reserverCreneau(ligne, debutMs, adresse) {
  var feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PARAMS.feuille);
  var lu = lireFiche_(feuille, ligne);
  var debut = new Date(debutMs);
  var fin = ajouterMinutes(debut, PARAMS.rdvMin);
  var cal = calendrierRdv_();
  var conflits = cal.getEvents(debut, fin).filter(function (e) {
    return !e.isAllDayEvent() && typeEvenement(e.getTitle()) === 'RDV';
  });
  if (conflits.length) throw new Error('Créneau pris entre-temps par « ' + conflits[0].getTitle() + ' ».');
  cal.createEvent(titreRdv(lu.fiche), debut, fin, { location: adresse, description: descriptionRdv(lu.fiche) });

  var colStatut = lu.entetes.indexOf('Statut appel') + 1;
  var colNotes = lu.entetes.indexOf('Notes d\'appel') + 1;
  if (colStatut > 0) feuille.getRange(ligne, colStatut).setValue('RDV OK');
  if (colNotes > 0) {
    var cellule = feuille.getRange(ligne, colNotes);
    var avant = String(cellule.getValue() || '');
    cellule.setValue((avant ? avant + ' / ' : '') + 'RDV ' + formatFr(debut));
  }
  return formatFr(debut);
}

function menuVerifierAgenda() {
  var maintenant = new Date();
  var r = verifierAgenda(lireEvenements_(maintenant), PARAMS, trajetMinutes_, maintenant);
  var html = '<div style="font-family:Arial,sans-serif;font-size:13px"><h3>Points à corriger</h3>';
  html += r.alertes.length ? '<ul>' + r.alertes.map(function (a) { return '<li>' + echapper_(a) + '</li>'; }).join('') + '</ul>'
    : '<p>Rien à signaler.</p>';
  html += '<h3>Hôtels</h3>';
  html += r.nuits.length ? '<ul>' + r.nuits.map(function (n) {
    return '<li><b>Nuit du ' + echapper_(n.nuit) + '</b> : ' + echapper_(n.conseil) + '<br><small>' +
      echapper_(n.dernier) + ' → ' + echapper_(n.premier) + (n.trajetMin !== null ? ' · ' + n.trajetMin + ' min' : '') +
      '</small></li>';
  }).join('') + '</ul>' : '<p>Aucune nuit à prévoir.</p>';
  html += '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(480), 'Agenda de Marc');
}

if (typeof module !== 'undefined') {
  module.exports = {
    PARAMS: PARAMS, normaliser: normaliser, typeEvenement: typeEvenement, localite: localite,
    formatFr: formatFr, construireSejours: construireSejours, proposerCreneaux: proposerCreneaux,
    verifierAgenda: verifierAgenda, ficheDepuisLigne: ficheDepuisLigne, titreRdv: titreRdv,
    descriptionRdv: descriptionRdv
  };
}
