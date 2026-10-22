// Taxonomie des thèmes : libellé, couleur, icône SVG (trait 1.6, viewBox 24).
export const THEMES = {
  horlogerie: { label: 'Horlogerie & microtechnique', color: '#9a6b2f', icon: '<circle cx="12" cy="12" r="6.5"/><path d="M12 8.5V12l2.5 1.5M9 3.5h6M9 20.5h6M9.5 5.8 9 3.5M14.5 5.8l.5-2.3M9.5 18.2 9 20.5M14.5 18.2l.5 2.3"/>' },
  industrie: { label: 'Industrie & sous-traitance', color: '#3d5a80', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>' },
  construction: { label: 'Construction & génie civil', color: '#c2410c', icon: '<path d="M4 21V5l9-2v4M4 9h16M15 9v5M13 14h4v3h-4zM2 21h20"/>' },
  architecture: { label: 'Architecture, ingénierie & immobilier', color: '#6b21a8', icon: '<path d="M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6M9 11h.01M15 11h.01"/>' },
  energie: { label: 'Énergie & environnement', color: '#15803d', icon: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>' },
  sante: { label: 'Santé & médical', color: '#be123c', icon: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>' },
  collectivites: { label: 'Collectivités & institutions publiques', color: '#1d4ed8', icon: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>' },
  economie: { label: 'Économie, finance & services', color: '#0f766e', icon: '<path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7"/>' },
  formation: { label: 'Formation, recherche & innovation', color: '#a16207', icon: '<path d="m2 9 10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>' },
  territoire: { label: 'Territoire, tourisme & culture', color: '#047857', icon: '<path d="m3 20 6-11 4 6 3-4 5 9zM16 6.5a1.5 1.5 0 1 0 0-.01"/>' },
  mobilite: { label: 'Transport & mobilité', color: '#475569', icon: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8.5 13h.01M15.5 13h.01M8 16l-2 4M16 16l2 4"/>' },
};

export const TYPES = {
  interview: 'Interview',
  publireportage: 'Publireportage',
  editorial: 'Éditorial',
  dossier: 'Dossier',
  portrait: 'Portrait',
  annonce: 'Annonce',
};

export const CANTONS = {
  AG: 'Argovie', AI: 'Appenzell R.-I.', AR: 'Appenzell R.-E.', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons', JU: 'Jura',
  LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald', SG: 'Saint-Gall', SH: 'Schaffhouse',
  SO: 'Soleure', SZ: 'Schwytz', TG: 'Thurgovie', TI: 'Tessin', UR: 'Uri', VD: 'Vaud', VS: 'Valais',
  ZG: 'Zoug', ZH: 'Zurich',
};
