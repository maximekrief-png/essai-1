// Tests du cœur du moteur d'agenda (sans services Google).
// Lancer : TZ=Europe/Zurich node --test apps-script/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../Agenda.gs');

// Temps de trajet fictifs en voiture (minutes), par localité.
const COORD = {
  'Neuchâtel': [46.992, 6.931], 'Marin-Epagnier': [47.010, 7.003], 'Peseux': [46.987, 6.889],
  'Cortaillod': [46.943, 6.845], 'La Sagne': [47.043, 6.807], 'Couvet': [46.925, 6.633],
  'Les Geneveys-sur-Coffrane': [47.015, 6.851], 'Saint-Blaise': [47.015, 6.989]
};
function trajet(a, b) {
  if (!a || !b) return 0;
  const la = A.localite(a), lb = A.localite(b);
  if (la === lb) return 0;
  const pa = COORD[la], pb = COORD[lb];
  if (!pa || !pb) return null;
  const km = Math.hypot((pa[0] - pb[0]) * 111, (pa[1] - pb[1]) * 76);
  return Math.round(km * 1.4 + 4);
}
const P = Object.assign({}, A.PARAMS);
const d = (j, h, m = 0) => new Date(2026, 9, j, h, m); // octobre 2026 : lundi 5 … vendredi 9
const ev = (titre, debut, lieu, min = 30) => ({
  titre, debut, fin: new Date(debut.getTime() + min * 60000), lieu, type: A.typeEvenement(titre)
});
const MAINTENANT = d(1, 9); // jeudi 1er octobre
const hm = (x) => x.getHours() * 60 + x.getMinutes();

test('localite et typeEvenement', () => {
  assert.equal(A.localite('Route de Boudry 26\nCortaillod, Suisse'), 'Cortaillod');
  assert.equal(A.localite('Sagne-Église 156B 2314\nLa Sagne NE, Suisse'), 'La Sagne');
  assert.equal(A.localite('Rue X 1, 2000 Neuchâtel'), 'Neuchâtel');
  assert.equal(A.typeEvenement('🚗 ARRIVÉE Marc'), 'ARRIVEE');
  assert.equal(A.typeEvenement('Départ Marc'), 'DEPART');
  assert.equal(A.typeEvenement('📞 Rappel – Planair SA'), 'AUTRE');
  assert.equal(A.typeEvenement('Appeler Fabio'), 'AUTRE');
  assert.equal(A.typeEvenement('Duckert SA'), 'RDV');
});

test('propose des créneaux sans détour, dont un collé au RDV déjà fixé dans la même localité', () => {
  const evs = [
    ev('ARRIVÉE Marc', d(5, 8), 'Gare, Neuchâtel', 0),
    ev('Plus Électricité', d(6, 10), 'Champs Montants 16B\nMarin-Epagnier, Suisse'),
    ev('Colas', d(6, 14), 'La Sagne NE, Suisse'),
    ev('DÉPART Marc', d(8, 17), 'Gare, Neuchâtel', 0)
  ];
  const r = A.proposerCreneaux(evs, 'Rue en Pellu 7\nMarin-Epagnier, Suisse', P, trajet, MAINTENANT);
  const best = r.propositions[0];
  assert.equal(best.implicite, false, 'le séjour confirmé passe avant les semaines sans bornes');
  assert.equal(best.detourMin, 0);
  // Le mardi, le créneau est collé à Plus Électricité (10h00-10h30), avant ou après, marge de 10 min comprise.
  const mardi = r.propositions.find((p) => p.debut.getDate() === 6);
  assert.ok(mardi, 'un créneau le mardi');
  const ecart = Math.min(Math.abs(d(6, 10) - mardi.fin), Math.abs(mardi.debut - d(6, 10, 30))) / 60000;
  assert.ok(ecart >= P.tamponMin && ecart <= P.tamponMin + P.pasMin, 'écart ' + ecart + ' min');
});

test('respecte l\'heure et le lieu d\'arrivée et de départ', () => {
  const evs = [
    ev('ARRIVÉE Marc', d(5, 10), 'Gare, Neuchâtel', 0),
    ev('DÉPART Marc', d(7, 16), 'Gare, Neuchâtel', 0)
  ];
  P.nbPropositions = 10;
  const r = A.proposerCreneaux(evs, 'Route de Boudry 26\nCortaillod, Suisse', P, trajet, MAINTENANT);
  P.nbPropositions = A.PARAMS.nbPropositions;
  assert.ok(r.propositions.length > 0);
  const t = trajet('Neuchâtel', 'Cortaillod');
  const confirmes = r.propositions.filter((p) => !p.implicite);
  assert.ok(confirmes.length > 0);
  for (const p of confirmes) {
    assert.ok(p.debut >= d(5, 10, t + P.tamponMin), 'pas avant l\'arrivée + trajet');
    assert.ok(p.fin <= d(7, 16, -(t + P.tamponMin)), 'fini avant le départ - trajet');
    assert.ok(p.debut.getDate() >= 5 && p.debut.getDate() <= 7);
  }
});

test('ne propose rien sur un jour déjà à 10 RDV', () => {
  const evs = [ev('ARRIVÉE Marc', d(5, 8), 'Neuchâtel', 0), ev('DÉPART Marc', d(5, 18, 30), 'Neuchâtel', 0)];
  for (let i = 0; i < 10; i++) evs.push(ev('RDV ' + i, d(5, 8, 30 + i * 50), 'Neuchâtel'));
  const r = A.proposerCreneaux(evs, 'Neuchâtel', P, trajet, MAINTENANT);
  assert.equal(r.propositions.filter((p) => p.debut.getDate() === 5).length, 0);
});

test('un RDV ajouté à la main n\'est jamais chevauché', () => {
  const evs = [
    ev('ARRIVÉE Marc', d(5, 8), 'Neuchâtel', 0),
    ev('DÉPART Marc', d(6, 18), 'Neuchâtel', 0)
  ];
  for (let h = 8; h < 18; h++) evs.push(ev('Manuel ' + h, d(5, h, 30), 'Peseux'));
  const r = A.proposerCreneaux(evs, 'Peseux', P, trajet, MAINTENANT);
  for (const p of r.propositions) {
    for (const e of evs.filter((x) => x.type === 'RDV')) {
      assert.ok(!(p.debut < e.fin && e.debut < p.fin), 'chevauche ' + e.titre);
    }
  }
});

test('ignore le passé et les rappels téléphoniques du calendrier RDV', () => {
  const evs = [
    ev('ARRIVÉE Marc', d(5, 8), 'Neuchâtel', 0),
    ev('📞 Rappel – Planair SA', d(5, 9), null, 30),
    ev('DÉPART Marc', d(5, 18), 'Neuchâtel', 0)
  ];
  const r = A.proposerCreneaux(evs, 'Neuchâtel', P, trajet, d(5, 12));
  assert.ok(r.propositions.every((p) => p.debut >= d(5, 13)));
  const v = A.verifierAgenda(evs, P, trajet, d(5, 7));
  assert.ok(v.alertes.some((a) => a.includes('est un rappel')));
});

test('semaine sans ARRIVÉE / DÉPART : propositions marquées comme implicites', () => {
  const evs = [ev('Systems Assembling', d(22, 9, 15), 'Route des Conrardes 12\nBoudry, Suisse')];
  const r = A.proposerCreneaux(evs, 'Neuchâtel', P, trajet, MAINTENANT);
  assert.ok(r.propositions.length > 0);
  assert.ok(r.propositions.every((p) => p.implicite));
});

test('vérification : enchaînement impossible, adresse manquante et conseil d\'hôtel', () => {
  const evs = [
    ev('ARRIVÉE Marc', d(5, 8), 'Neuchâtel', 0),
    ev('Plus Électricité', d(6, 10), 'Marin-Epagnier'),
    ev('Colas', d(6, 10, 45), 'La Sagne NE, Suisse'),
    ev('rdv horlogerie', d(6, 11, 30), null),
    ev('Geosit', d(6, 17, 30), 'Marin-Epagnier'),
    ev('Duckert', d(7, 8), 'Cortaillod'),
    ev('GVH', d(7, 17), 'Saint-Blaise'),
    ev('RMT', d(8, 8), 'Couvet'),
    ev('DÉPART Marc', d(8, 12), 'Neuchâtel', 0)
  ];
  const v = A.verifierAgenda(evs, P, trajet, MAINTENANT);
  assert.ok(v.alertes.some((a) => a.includes('Enchaînement trop serré') && a.includes('Colas')));
  assert.ok(v.alertes.some((a) => a.includes('rdv horlogerie') && a.includes('adresse')));
  assert.equal(v.nuits.length, 2);
  // Marin -> Cortaillod : ~21 min, sous le seuil : hôtel près du dernier RDV
  assert.match(v.nuits[0].conseil, /Marin-Epagnier/);
  // Saint-Blaise -> Couvet : > 25 min : hôtel près du premier RDV du lendemain
  assert.match(v.nuits[1].conseil, /Couvet/);
});

test('fiche du Sheet : premier bloc dirigeant, titre et description du RDV', () => {
  const entetes = ['Priorité', 'Entreprise', 'Nom', 'Fonction', 'Portable', 'Nom', 'Standard', 'Ville', 'Projet à évoquer (Deicher)', 'ID'];
  const valeurs = ['1 · Prioritaire', 'Exemple SA', 'J. Martin', 'Directeur', '+41 79 000 00 00', 'Autre', '+41 32 000 00 00', 'Cortaillod', 'Chantier X', 'E9999'];
  const f = A.ficheDepuisLigne(entetes, valeurs);
  assert.equal(f.dirigeant, 'J. Martin');
  assert.equal(A.titreRdv(f), 'Exemple SA – J. Martin');
  assert.match(A.descriptionRdv(f), /Fiche E9999\nDirigeant : J\. Martin – Directeur\nPortable/);
});
