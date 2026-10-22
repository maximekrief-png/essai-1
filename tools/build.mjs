// Générateur du site statique Swiss Knowhow.
// Lit data/magazines/*.json (+ data/images.json) et écrit le site dans docs/.
// Usage : node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, TYPES, CANTONS } from './themes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const DATA = path.join(ROOT, 'data');
const SITE_NAME = 'Swiss Knowhow';
const SITE_URL = 'https://swissknowhow.ch';

// ---------- utilitaires ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugify = (s) => fold(s).replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const uniq = (a) => [...new Set(a.filter(Boolean))];
const write = (rel, content) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};
const exists = (rel) => fs.existsSync(path.join(OUT, rel));
const domainOf = (w) => fold(w).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
const webUrl = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w.replace(/^\/+/, '')}`);
const telUrl = (p) => 'tel:' + p.replace(/[^+\d]/g, '').replace(/^00/, '+');
const initials = (name) => fold(name).replace(/\b(sa|ag|sarl|gmbh|ltd|inc|the|la|le|les|de|du|des|et)\b/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '•';
const driveView = (id) => `https://drive.google.com/file/d/${id}/view`;
const driveDownload = (id) => `https://drive.google.com/uc?export=download&id=${id}`;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// ---------- chargement ----------
const magFiles = fs.existsSync(path.join(DATA, 'magazines'))
  ? fs.readdirSync(path.join(DATA, 'magazines')).filter((f) => f.endsWith('.json'))
  : [];
const images = fs.existsSync(path.join(DATA, 'images.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'images.json'), 'utf8')) : { articles: {}, companies: {} };

const magazines = [];
const articles = [];
const companyMap = new Map(); // slug -> merged company
const domainIndex = new Map(); // domaine web -> slug canonique

for (const f of magFiles) {
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(DATA, 'magazines', f), 'utf8')); } catch (e) { console.warn('JSON invalide', f, e.message); continue; }
  m.slug ||= f.replace(/\.json$/, '');
  m.articles ||= []; m.companies ||= []; m.files ||= []; m.themes ||= [];
  magazines.push(m);
}
magazines.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title, 'fr'));

const validThemes = (t) => uniq((t || []).filter((x) => THEMES[x]));

// Fusion des entreprises : même slug ou même domaine web = même entreprise.
// Les magazines sont triés du plus récent au plus ancien : la première valeur non vide l'emporte.
const companyAlias = new Map(); // `${mag}:${slugLocal}` -> slug canonique
// Doublons connus (même organisation nommée différemment selon les numéros)
const ALIASES = fs.existsSync(path.join(DATA, 'aliases.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'aliases.json'), 'utf8')) : {};
for (const m of magazines) {
  for (const c of m.companies) {
    if (!c.name) continue;
    let key = slugify(c.slug || c.name);
    key = ALIASES[key] || key;
    const dom = c.website ? domainOf(c.website) : '';
    if (dom && domainIndex.has(dom)) key = domainIndex.get(dom);
    companyAlias.set(`${m.slug}:${c.slug || slugify(c.name)}`, key);
    let t = companyMap.get(key);
    if (!t) {
      t = { slug: key, name: c.name, sector: '', description: '', address: '', postalCode: '', city: '', canton: '', country: '', phone: '', email: '', website: '', contacts: [], themes: [], appearances: [], advertiserOnly: true };
      companyMap.set(key, t);
    }
    if (dom && !domainIndex.has(dom)) domainIndex.set(dom, key);
    for (const k of ['sector', 'address', 'postalCode', 'city', 'canton', 'country', 'phone', 'email', 'website']) if (!t[k] && c[k]) t[k] = String(c[k]).trim();
    if ((c.description || '').length > (t.description || '').length * 1.4 || !t.description) t.description = c.description || t.description;
    t.themes = uniq([...t.themes, ...validThemes(c.themes)]);
    for (const p of c.contacts || []) if (p?.name && !t.contacts.some((x) => fold(x.name) === fold(p.name))) t.contacts.push(p);
    t.advertiserOnly = t.advertiserOnly && !!c.advertiserOnly;
    t.appearances.push({ magazine: m.slug, page: c.page || '', articles: [] });
    const img = images.companies?.[`${m.slug}:${c.slug}`];
    if (img?.length) t.images = uniq([...(t.images || []), ...img]);
  }
}
const resolveCompany = (mag, s) => companyAlias.get(`${mag}:${s}`) || (companyMap.has(slugify(s)) ? slugify(s) : null);

const articleSlugs = new Set();
for (const m of magazines) {
  m.articleSlugs = [];
  for (const a of m.articles) {
    if (!a.title) continue;
    let s = slugify(a.slug || `${m.slug}-${a.title}`).slice(0, 90);
    while (articleSlugs.has(s)) s += '-2';
    articleSlugs.add(s);
    const art = { ...a, slug: s, magazine: m.slug, themes: validThemes(a.themes).length ? validThemes(a.themes) : validThemes(m.themes).slice(0, 1) };
    art.companies = uniq((a.companies || []).map((x) => resolveCompany(m.slug, x)));
    art.images = images.articles?.[`${m.slug}:${a.slug}`] || [];
    for (const cs of art.companies) {
      const c = companyMap.get(cs);
      const ap = c.appearances.find((x) => x.magazine === m.slug);
      if (ap) ap.articles.push(s); else c.appearances.push({ magazine: m.slug, page: a.page || '', articles: [s] });
      c.advertiserOnly = false;
      if (!c.images?.length && art.images.length) c.images = art.images.slice(0, 2);
      c.themes = uniq([...c.themes, ...art.themes]);
    }
    articles.push(art);
    m.articleSlugs.push(s);
  }
}
const companies = [...companyMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
for (const c of companies) {
  if (!c.themes.length) c.themes = validThemes(magazines.find((m) => m.slug === c.appearances[0]?.magazine)?.themes).slice(0, 1);
  if (c.canton) c.canton = c.canton.toUpperCase().slice(0, 2);
}
const magBySlug = Object.fromEntries(magazines.map((m) => [m.slug, m]));
const artBySlug = Object.fromEntries(articles.map((a) => [a.slug, a]));
for (const m of magazines) {
  m.cover = exists(`assets/covers/${m.slug}.webp`) ? `assets/covers/${m.slug}.webp` : '';
  m.companySlugs = companies.filter((c) => c.appearances.some((x) => x.magazine === m.slug)).map((c) => c.slug);
}

// ---------- gabarits ----------
const themeIcon = (id, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${THEMES[id]?.icon || ''}</svg>`;
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4 19h16"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5V4.5M8 7h8"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  map: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};
const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

const NAV = [
  ['', 'Accueil'],
  ['entreprises/', 'Annuaire'],
  ['articles/', 'Articles'],
  ['themes/', 'Thèmes'],
  ['magazines/', 'Magazines PDF'],
];

function layout({ depth, title, description = '', active = '', body, jsonld = '', image = '' }) {
  const r = '../'.repeat(depth);
  const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — L'annuaire du savoir-faire suisse`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description.slice(0, 300))}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description.slice(0, 300))}">
<meta property="og:type" content="website">
${image ? `<meta property="og:image" content="${esc(r + image)}">` : ''}
<meta name="theme-color" content="#c8102e">
<link rel="icon" href="${r}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${r}assets/css/style.css">
<script>try{const t=localStorage.getItem('skh-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head>
<body data-root="${r}">
<a class="skip" href="#main">Aller au contenu</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${r}" aria-label="${SITE_NAME} — accueil">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#c8102e"/><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff"/></svg></span>
      <span class="brand-text">Swiss <b>Knowhow</b></span>
    </a>
    <nav class="main-nav" aria-label="Navigation principale">
      ${NAV.map(([href, label]) => `<a href="${r}${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    <div class="header-actions">
      <button class="search-trigger" type="button" data-search-open aria-label="Rechercher">${icon('search')}<span>Rechercher…</span><kbd>Ctrl K</kbd></button>
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Basculer le thème clair/sombre">${icon('moon')}</button>
      <button class="icon-btn menu-btn" type="button" data-menu aria-label="Menu" aria-expanded="false">${icon('menu')}</button>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="${r}"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#c8102e"/><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff"/></svg></span><span class="brand-text">Swiss <b>Knowhow</b></span></a>
      <p>Le magazine du savoir-faire suisse : entreprises, institutions et acteurs de l'économie, de l'horlogerie, de la santé et des grands travaux.</p>
    </div>
    <div>
      <h3>Explorer</h3>
      ${NAV.map(([href, label]) => `<a href="${r}${href}">${label}</a>`).join('')}
    </div>
    <div>
      <h3>Thèmes</h3>
      ${Object.entries(THEMES).slice(0, 6).map(([id, t]) => `<a href="${r}themes/${id}/">${esc(t.label)}</a>`).join('')}
    </div>
  </div>
  <div class="wrap footer-bottom">© ${new Date().getFullYear()} ${SITE_NAME} · Contenus issus des éditions imprimées du magazine.</div>
</footer>
<div class="search-overlay" data-search-overlay hidden>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="Recherche">
    <div class="search-field">${icon('search')}<input type="search" placeholder="Entreprise, personne, ville, thème, article…" autocomplete="off" data-search-input aria-label="Rechercher"><button type="button" class="icon-btn" data-search-close aria-label="Fermer">${icon('close')}</button></div>
    <div class="search-results" data-search-results></div>
  </div>
</div>
<script src="${r}assets/js/app.js" defer></script>
</body>
</html>`;
}

const themeChip = (id, r) => THEMES[id] ? `<a class="chip" style="--c:${THEMES[id].color}" href="${r}themes/${id}/">${themeIcon(id)}${esc(THEMES[id].label)}</a>` : '';
const placeholder = (name, themeId, cls = '') => {
  const t = THEMES[themeId] || { color: '#64748b' };
  return `<div class="ph ${cls}" style="--c:${t.color}" aria-hidden="true"><span>${esc(initials(name))}</span>${themeId ? themeIcon(themeId, 'ph-ico') : ''}</div>`;
};
const img = (src, alt, r, cls = '') => `<img class="${cls}" src="${r}${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
const location = (c) => [c.postalCode && c.city ? `${c.postalCode} ${c.city}` : c.city, c.canton && CANTONS[c.canton] ? CANTONS[c.canton] : (c.country && c.country !== 'Suisse' ? c.country : '')].filter(Boolean).join(' · ');

function magCover(m, r, cls = '') {
  if (m.cover) return `<div class="cover ${cls}">${img(m.cover, `Couverture — ${m.title}`, r)}</div>`;
  const t = THEMES[m.themes?.[0]] || { color: '#c8102e' };
  return `<div class="cover cover-gen ${cls}" style="--c:${t.color}" aria-hidden="true"><span class="cg-brand">SWISS<br>KNOWHOW</span><span class="cg-title">${esc(m.series || m.title)}</span><span class="cg-year">${m.year || ''}</span>${m.themes?.[0] ? themeIcon(m.themes[0], 'cg-ico') : ''}</div>`;
}

function companyCard(c, r) {
  const th = c.themes[0];
  const media = c.images?.length ? img(c.images[0], c.name, r, 'card-img') : placeholder(c.name, th, 'card-img');
  return `<a class="card company-card" href="${r}entreprises/${c.slug}/" data-name="${esc(fold(c.name))}" data-themes="${esc(c.themes.join(' '))}" data-canton="${esc(c.canton)}" data-letter="${esc((fold(c.name).match(/[a-z]/) || ['#'])[0])}" data-q="${esc(fold([c.name, c.sector, c.city, c.canton, CANTONS[c.canton] || '', c.contacts.map((p) => p.name).join(' ')].join(' ')))}">
  <div class="card-media">${media}</div>
  <div class="card-body">
    <h3>${esc(c.name)}</h3>
    ${c.sector ? `<p class="muted">${esc(c.sector)}</p>` : ''}
    ${location(c) ? `<p class="meta">${icon('pin', 'ico sm')}${esc(location(c))}</p>` : ''}
    <div class="card-tags">${c.themes.slice(0, 2).map((id) => `<span class="tag" style="--c:${THEMES[id].color}">${esc(THEMES[id].label.split(/[ ,&]/)[0])}</span>`).join('')}${c.advertiserOnly ? '<span class="tag tag-muted">Annonceur</span>' : ''}</div>
  </div>
</a>`;
}

function articleCard(a, r, { showMag = true } = {}) {
  const m = magBySlug[a.magazine];
  const th = a.themes[0];
  const media = a.images?.length ? img(a.images[0], a.title, r, 'card-img') : placeholder(a.title, th, 'card-img');
  return `<a class="card article-card" href="${r}articles/${a.slug}/" data-themes="${esc(a.themes.join(' '))}" data-type="${esc(a.type || '')}" data-mag="${esc(a.magazine)}" data-q="${esc(fold([a.title, a.subtitle, a.region, (a.people || []).map((p) => p.name).join(' '), m?.title].join(' ')))}">
  <div class="card-media">${media}${a.type && TYPES[a.type] ? `<span class="badge">${TYPES[a.type]}</span>` : ''}</div>
  <div class="card-body">
    <h3>${esc(a.title)}</h3>
    ${a.subtitle ? `<p class="muted clamp2">${esc(a.subtitle)}</p>` : ''}
    ${showMag && m ? `<p class="meta">${icon('book', 'ico sm')}${esc(m.series || m.title)} ${m.year || ''}${a.page ? ` · p. ${esc(a.page)}` : ''}</p>` : ''}
  </div>
</a>`;
}

function magCard(m, r) {
  const f = m.files[0];
  return `<article class="mag-card" data-series="${esc(m.series || '')}" data-q="${esc(fold([m.title, m.series, m.region, m.year].join(' ')))}">
  <a href="${r}magazines/${m.slug}/" class="mag-cover-link">${magCover(m, r)}</a>
  <div class="mag-body">
    <p class="eyebrow">${esc(m.series || '')}${m.year ? ` · ${m.year}` : ''}</p>
    <h3><a href="${r}magazines/${m.slug}/">${esc(m.title)}</a></h3>
    <p class="meta">${plural(m.articleSlugs.length, 'article', 'articles')} · ${plural(m.companySlugs.length, 'entreprise', 'entreprises')}</p>
    <div class="mag-actions">
      ${f ? `<a class="btn btn-primary btn-sm" href="${driveDownload(f.driveId)}" target="_blank" rel="noopener">${icon('download', 'ico sm')}PDF${f.sizeMB ? ` · ${f.sizeMB} Mo` : ''}</a>
      <a class="btn btn-ghost btn-sm" href="${driveView(f.driveId)}" target="_blank" rel="noopener">${icon('eye', 'ico sm')}Lire</a>` : ''}
    </div>
  </div>
</article>`;
}

const sectionHead = (title, link, r, linkLabel = 'Tout voir') => `<div class="section-head"><h2>${title}</h2>${link ? `<a class="link-arrow" href="${r}${link}">${linkLabel}${icon('arrow', 'ico sm')}</a>` : ''}</div>`;
const crumbs = (items, r) => `<nav class="crumbs" aria-label="Fil d'Ariane"><a href="${r}">Accueil</a>${items.map(([href, label]) => href ? `<a href="${r}${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`).join('')}</nav>`;

// ---------- pages ----------
function pageHome() {
  const r = '';
  const withImg = articles.filter((a) => a.images?.length && a.type !== 'annonce');
  const featured = [...withImg, ...articles.filter((a) => !a.images?.length && a.type !== 'annonce')].slice(0, 6);
  const featCompanies = companies.filter((c) => c.images?.length && !c.advertiserOnly).slice(0, 8);
  const heroImgs = uniq([...withImg.flatMap((a) => a.images.slice(0, 1))]).slice(0, 5);
  const themeCounts = Object.keys(THEMES).map((id) => [id, companies.filter((c) => c.themes.includes(id)).length, articles.filter((a) => a.themes.includes(id)).length]);
  const body = `
<section class="hero">
  <div class="hero-bg" aria-hidden="true">${heroImgs.map((s, i) => `<img src="${esc(s)}" alt="" style="--i:${i}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`).join('')}</div>
  <div class="wrap hero-inner">
    <p class="eyebrow light">Le magazine du savoir-faire suisse</p>
    <h1>L'annuaire des entreprises<br>qui font la Suisse.</h1>
    <p class="lead">${plural(companies.length, 'entreprise', 'entreprises')}, ${plural(articles.length, 'article', 'articles')} et ${plural(magazines.length, 'magazine', 'magazines')} : horlogerie, industrie, santé, grands travaux, collectivités.</p>
    <form class="hero-search" action="${r}recherche/" role="search">
      ${icon('search')}
      <input type="search" name="q" placeholder="Rechercher une entreprise, une ville, une personne…" aria-label="Rechercher" data-hero-search autocomplete="off">
      <button class="btn btn-primary" type="submit">Rechercher</button>
    </form>
    <div class="hero-quick">${['horlogerie', 'sante', 'construction', 'collectivites', 'energie'].map((id) => `<a href="${r}themes/${id}/">${esc(THEMES[id].label.split(' &')[0])}</a>`).join('')}</div>
  </div>
</section>
<section class="wrap stats">
  <div><b>${companies.length}</b><span>entreprises & institutions</span></div>
  <div><b>${articles.length}</b><span>articles & interviews</span></div>
  <div><b>${magazines.length}</b><span>magazines à télécharger</span></div>
  <div><b>${uniq(companies.map((c) => c.canton)).length}</b><span>cantons représentés</span></div>
</section>
<section class="wrap section">
  ${sectionHead('Explorer par thème', 'themes/', r)}
  <div class="theme-grid">
    ${themeCounts.filter(([, c, a]) => c + a > 0).map(([id, c, a]) => `<a class="theme-card" href="${r}themes/${id}/" style="--c:${THEMES[id].color}">${themeIcon(id, 'theme-ico')}<h3>${esc(THEMES[id].label)}</h3><p>${plural(c, 'entreprise', 'entreprises')} · ${plural(a, 'article', 'articles')}</p></a>`).join('')}
  </div>
</section>
<section class="section band">
  <div class="wrap">
    ${sectionHead('Derniers magazines', 'magazines/', r, 'Tous les PDF')}
    <div class="mag-rail">${magazines.slice(0, 8).map((m) => magCard(m, r)).join('')}</div>
  </div>
</section>
<section class="wrap section">
  ${sectionHead('À la une', 'articles/', r, 'Tous les articles')}
  <div class="grid grid-3">${featured.map((a) => articleCard(a, r)).join('')}</div>
</section>
${featCompanies.length ? `<section class="wrap section">
  ${sectionHead("Dans l'annuaire", 'entreprises/', r, "Tout l'annuaire")}
  <div class="grid grid-4">${featCompanies.map((c) => companyCard(c, r)).join('')}</div>
</section>` : ''}`;
  write('index.html', layout({ depth: 0, title: '', description: `Annuaire Swiss Knowhow : ${companies.length} entreprises, ${articles.length} articles et ${magazines.length} magazines PDF sur le savoir-faire suisse.`, active: '', body, image: heroImgs[0] }));
}

function filterBar({ withThemes = true, cantons = [], extra = '' }) {
  return `<div class="filters" data-filters>
  <div class="filter-search">${icon('search')}<input type="search" placeholder="Filtrer…" data-filter-q aria-label="Filtrer la liste"></div>
  ${withThemes ? `<select data-filter-theme aria-label="Thème"><option value="">Tous les thèmes</option>${Object.entries(THEMES).map(([id, t]) => `<option value="${id}">${esc(t.label)}</option>`).join('')}</select>` : ''}
  ${cantons.length ? `<select data-filter-canton aria-label="Canton"><option value="">Tous les cantons</option>${cantons.map((c) => `<option value="${c}">${esc(CANTONS[c] || c)}</option>`).join('')}</select>` : ''}
  ${extra}
  <span class="filter-count" data-filter-count></span>
</div>`;
}

function pageCompanies() {
  const r = '../';
  const cantons = uniq(companies.map((c) => c.canton)).filter((c) => CANTONS[c]).sort((a, b) => CANTONS[a].localeCompare(CANTONS[b], 'fr'));
  const letters = uniq(companies.map((c) => (fold(c.name).match(/[a-z]/) || ['#'])[0])).sort();
  const body = `
<section class="page-head wrap">
  ${crumbs([[null, 'Annuaire']], r)}
  <h1>Annuaire des entreprises</h1>
  <p class="lead">${plural(companies.length, 'entreprise, institution ou organisation présentée', 'entreprises, institutions et organisations présentées')} dans les magazines Swiss Knowhow, avec leurs coordonnées.</p>
</section>
<section class="wrap">
  ${filterBar({ cantons, extra: `<label class="toggle"><input type="checkbox" data-filter-noads> Masquer les annonceurs seuls</label>` })}
  <div class="letters" data-letters>${['', ...letters].map((l) => `<button type="button" data-letter="${l}"${l ? '' : ' aria-pressed="true"'}>${l ? l.toUpperCase() : 'Tout'}</button>`).join('')}</div>
  <div class="grid grid-4" data-list>${companies.map((c) => companyCard(c, r)).join('')}</div>
  <p class="empty" data-empty hidden>Aucune entreprise ne correspond à ces critères.</p>
</section>`;
  write('entreprises/index.html', layout({ depth: 1, title: 'Annuaire des entreprises', description: `Annuaire de ${companies.length} entreprises suisses présentées dans Swiss Knowhow : coordonnées, secteurs, articles.`, active: 'entreprises/', body }));
}

function pageCompany(c) {
  const r = '../../';
  const th = c.themes[0];
  const apps = c.appearances.map((ap) => ({ ...ap, m: magBySlug[ap.magazine] })).filter((x) => x.m);
  const arts = uniq(apps.flatMap((x) => x.articles)).map((s) => artBySlug[s]).filter(Boolean);
  const related = companies.filter((o) => o !== c && o.themes.some((t) => c.themes.includes(t)) && (o.canton && o.canton === c.canton)).slice(0, 4);
  const addr = [c.address, [c.postalCode, c.city].filter(Boolean).join(' ')].filter(Boolean);
  const mapQ = encodeURIComponent([c.name, ...addr, c.country || 'Suisse'].join(', '));
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Organization', name: c.name, description: c.description || undefined,
    url: c.website ? webUrl(c.website) : undefined, telephone: c.phone || undefined, email: c.email || undefined,
    address: addr.length ? { '@type': 'PostalAddress', streetAddress: c.address || undefined, postalCode: c.postalCode || undefined, addressLocality: c.city || undefined, addressRegion: c.canton || undefined, addressCountry: c.country || 'CH' } : undefined,
  }).replace(/</g, '\\u003c');
  const gallery = (c.images || []).slice(0, 6);
  const body = `
<section class="detail-hero" style="--c:${THEMES[th]?.color || '#c8102e'}">
  <div class="wrap detail-hero-inner">
    <div class="detail-media">${gallery.length ? img(gallery[0], c.name, r, 'detail-img') : placeholder(c.name, th, 'detail-img')}</div>
    <div class="detail-text">
      ${crumbs([['entreprises/', 'Annuaire'], [null, c.name]], r)}
      <h1>${esc(c.name)}</h1>
      ${c.sector ? `<p class="lead">${esc(c.sector)}</p>` : ''}
      ${location(c) ? `<p class="meta">${icon('pin', 'ico sm')}${esc(location(c))}</p>` : ''}
      <div class="chips">${c.themes.map((id) => themeChip(id, r)).join('')}</div>
    </div>
  </div>
</section>
<div class="wrap detail-grid">
  <article class="detail-main">
    ${c.description ? `<section><h2>Présentation</h2><p class="prose">${esc(c.description)}</p></section>` : ''}
    ${gallery.length > 1 ? `<section><h2>Photos</h2><div class="gallery">${gallery.map((s) => `<a href="${r}${esc(s)}" data-lightbox>${img(s, c.name, r)}</a>`).join('')}</div></section>` : ''}
    ${arts.length ? `<section><h2>Articles</h2><div class="grid grid-2">${arts.map((a) => articleCard(a, r)).join('')}</div></section>` : ''}
    <section><h2>Parutions</h2><ul class="appear-list">${apps.map((x) => `<li><a href="${r}magazines/${x.m.slug}/">${magCover(x.m, r, 'xs')}<span><b>${esc(x.m.title)}</b><span class="muted">${x.m.year || ''}${x.page ? ` · page ${esc(x.page)}` : ''}</span></span></a>${x.m.files[0] ? `<a class="btn btn-ghost btn-sm" href="${driveView(x.m.files[0].driveId)}" target="_blank" rel="noopener">${icon('eye', 'ico sm')}PDF</a>` : ''}</li>`).join('')}</ul></section>
  </article>
  <aside class="detail-side">
    <div class="contact-card">
      <h2>Coordonnées</h2>
      ${addr.length ? `<p class="ci">${icon('pin')}<span>${addr.map(esc).join('<br>')}${c.country && c.country !== 'Suisse' ? `<br>${esc(c.country)}` : ''}</span></p>` : ''}
      ${c.phone ? `<p class="ci">${icon('phone')}<a href="${telUrl(c.phone)}">${esc(c.phone)}</a></p>` : ''}
      ${c.email ? `<p class="ci">${icon('mail')}<a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>` : ''}
      ${c.website ? `<p class="ci">${icon('web')}<a href="${esc(webUrl(c.website))}" target="_blank" rel="noopener">${esc(c.website.replace(/^https?:\/\//, ''))}</a></p>` : ''}
      ${!addr.length && !c.phone && !c.email && !c.website ? '<p class="muted">Coordonnées non communiquées dans le magazine.</p>' : ''}
      ${addr.length ? `<a class="btn btn-ghost btn-block" href="https://www.google.com/maps/search/?api=1&query=${mapQ}" target="_blank" rel="noopener">${icon('map', 'ico sm')}Voir sur la carte</a>` : ''}
      ${c.website ? `<a class="btn btn-primary btn-block" href="${esc(webUrl(c.website))}" target="_blank" rel="noopener">${icon('web', 'ico sm')}Site web</a>` : ''}
    </div>
    ${c.contacts.length ? `<div class="contact-card"><h2>Interlocuteurs</h2>${c.contacts.map((p) => `<p class="ci">${icon('user')}<span><b>${esc(p.name)}</b>${p.role ? `<br><span class="muted">${esc(p.role)}</span>` : ''}</span></p>`).join('')}</div>` : ''}
  </aside>
</div>
${related.length ? `<section class="wrap section">${sectionHead('Dans le même secteur et la même région', '', r)}<div class="grid grid-4">${related.map((o) => companyCard(o, r)).join('')}</div></section>` : ''}`;
  write(`entreprises/${c.slug}/index.html`, layout({ depth: 2, title: c.name, description: c.description || `${c.name}${c.sector ? ' — ' + c.sector : ''}${c.city ? ', ' + c.city : ''}`, active: 'entreprises/', body, jsonld, image: gallery[0] }));
}

function pageArticles() {
  const r = '../';
  const list = articles.filter((a) => a.type !== 'annonce');
  const typeSel = `<select data-filter-type aria-label="Type"><option value="">Tous les types</option>${Object.entries(TYPES).filter(([k]) => k !== 'annonce').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`;
  const magSel = `<select data-filter-mag aria-label="Magazine"><option value="">Tous les magazines</option>${magazines.map((m) => `<option value="${m.slug}">${esc(m.title)}</option>`).join('')}</select>`;
  const body = `
<section class="page-head wrap">
  ${crumbs([[null, 'Articles']], r)}
  <h1>Articles & interviews</h1>
  <p class="lead">${plural(list.length, 'article', 'articles')} issus des magazines : interviews de dirigeants et d'élus, publireportages, dossiers thématiques.</p>
</section>
<section class="wrap">
  ${filterBar({ extra: typeSel + magSel })}
  <div class="grid grid-3" data-list>${list.map((a) => articleCard(a, r)).join('')}</div>
  <p class="empty" data-empty hidden>Aucun article ne correspond à ces critères.</p>
</section>`;
  write('articles/index.html', layout({ depth: 1, title: 'Articles & interviews', description: `${list.length} articles, interviews et publireportages Swiss Knowhow.`, active: 'articles/', body }));
}

function pageArticle(a) {
  const r = '../../';
  const m = magBySlug[a.magazine];
  const th = a.themes[0];
  const cos = a.companies.map((s) => companyMap.get(s)).filter(Boolean);
  const same = articles.filter((o) => o !== a && o.type !== 'annonce' && o.themes.some((t) => a.themes.includes(t))).slice(0, 3);
  const f = m?.files?.[0];
  const body = `
<article>
<header class="article-head wrap narrow">
  ${crumbs([['articles/', 'Articles'], [null, a.title]], r)}
  <p class="eyebrow">${a.type && TYPES[a.type] ? TYPES[a.type] : 'Article'}${a.region ? ` · ${esc(a.region)}` : ''}</p>
  <h1>${esc(a.title)}</h1>
  ${a.subtitle ? `<p class="lead">${esc(a.subtitle)}</p>` : ''}
  <div class="chips">${a.themes.map((id) => themeChip(id, r)).join('')}</div>
</header>
<div class="wrap article-media">${a.images?.length ? img(a.images[0], a.title, r, 'article-img') : placeholder(a.title, th, 'article-img')}</div>
<div class="wrap narrow article-body">
  <p class="prose">${esc(a.summary || '')}</p>
  ${a.quote ? `<blockquote>« ${esc(a.quote.replace(/^[«"“\s]+|[»"”\s]+$/g, ''))} »${a.people?.[0] ? `<cite>— ${esc(a.people[0].name)}</cite>` : ''}</blockquote>` : ''}
  ${a.images?.length > 1 ? `<div class="gallery">${a.images.slice(1, 7).map((s) => `<a href="${r}${esc(s)}" data-lightbox>${img(s, a.title, r)}</a>`).join('')}</div>` : ''}
  ${a.people?.length ? `<h2>Personnes citées</h2><ul class="people">${a.people.map((p) => `<li>${icon('user')}<span><b>${esc(p.name)}</b>${p.role ? `<span class="muted">${esc(p.role)}</span>` : ''}</span></li>`).join('')}</ul>` : ''}
  ${m ? `<div class="source-box">
    <a href="${r}magazines/${m.slug}/">${magCover(m, r, 'sm')}</a>
    <div><p class="eyebrow">Paru dans</p><h3><a href="${r}magazines/${m.slug}/">${esc(m.title)}</a></h3><p class="muted">${m.year || ''}${a.page ? ` · page ${esc(a.page)}` : ''}${a.language ? ` · article original en ${({ fr: 'français', de: 'allemand', it: 'italien', en: 'anglais' })[a.language] || a.language}` : ''}</p>
    ${f ? `<a class="btn btn-primary btn-sm" href="${driveView(f.driveId)}" target="_blank" rel="noopener">${icon('book', 'ico sm')}Lire l'article complet (PDF)</a>` : ''}</div>
  </div>` : ''}
</div>
</article>
${cos.length ? `<section class="wrap section">${sectionHead(cos.length > 1 ? 'Entreprises citées' : 'Entreprise citée', '', r)}<div class="grid grid-4">${cos.map((c) => companyCard(c, r)).join('')}</div></section>` : ''}
${same.length ? `<section class="wrap section">${sectionHead('Sur le même thème', `themes/${th}/`, r)}<div class="grid grid-3">${same.map((o) => articleCard(o, r)).join('')}</div></section>` : ''}`;
  const jsonld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.summary, isPartOf: m ? { '@type': 'PublicationIssue', name: m.title, datePublished: m.year ? String(m.year) : undefined } : undefined }).replace(/</g, '\\u003c');
  write(`articles/${a.slug}/index.html`, layout({ depth: 2, title: a.title, description: a.summary || a.subtitle || '', active: 'articles/', body, jsonld, image: a.images?.[0] }));
}

function pageThemes() {
  const r = '../';
  const body = `
<section class="page-head wrap">
  ${crumbs([[null, 'Thèmes']], r)}
  <h1>Thèmes</h1>
  <p class="lead">Parcourez l'annuaire et les articles par secteur d'activité.</p>
</section>
<section class="wrap"><div class="theme-grid large">
${Object.entries(THEMES).map(([id, t]) => {
    const nc = companies.filter((c) => c.themes.includes(id)).length;
    const na = articles.filter((a) => a.themes.includes(id)).length;
    return `<a class="theme-card" href="${r}themes/${id}/" style="--c:${t.color}">${themeIcon(id, 'theme-ico')}<h3>${esc(t.label)}</h3><p>${plural(nc, 'entreprise', 'entreprises')} · ${plural(na, 'article', 'articles')}</p></a>`;
  }).join('')}
</div></section>`;
  write('themes/index.html', layout({ depth: 1, title: 'Thèmes', description: 'Les thèmes de Swiss Knowhow : horlogerie, industrie, santé, construction, énergie, collectivités…', active: 'themes/', body }));
}

function pageTheme(id) {
  const r = '../../';
  const t = THEMES[id];
  const cs = companies.filter((c) => c.themes.includes(id));
  const as = articles.filter((a) => a.themes.includes(id) && a.type !== 'annonce');
  const ms = magazines.filter((m) => m.themes.includes(id));
  const body = `
<section class="theme-hero" style="--c:${t.color}">
  <div class="wrap">
    ${crumbs([['themes/', 'Thèmes'], [null, t.label]], r)}
    <div class="theme-hero-row">${themeIcon(id, 'theme-ico xl')}<div><h1>${esc(t.label)}</h1><p class="lead">${plural(cs.length, 'entreprise', 'entreprises')} · ${plural(as.length, 'article', 'articles')} · ${plural(ms.length, 'magazine', 'magazines')}</p></div></div>
  </div>
</section>
${as.length ? `<section class="wrap section">${sectionHead('Articles', '', r)}<div class="grid grid-3">${as.map((a) => articleCard(a, r)).join('')}</div></section>` : ''}
${cs.length ? `<section class="wrap section">${sectionHead('Entreprises', '', r)}
  ${filterBar({ withThemes: false })}
  <div class="grid grid-4" data-list>${cs.map((c) => companyCard(c, r)).join('')}</div><p class="empty" data-empty hidden>Aucun résultat.</p></section>` : ''}
${ms.length ? `<section class="section band"><div class="wrap">${sectionHead('Magazines', 'magazines/', r, 'Tous les PDF')}<div class="mag-rail">${ms.map((m) => magCard(m, r)).join('')}</div></div></section>` : ''}`;
  write(`themes/${id}/index.html`, layout({ depth: 2, title: t.label, description: `${t.label} : ${cs.length} entreprises et ${as.length} articles dans l'annuaire Swiss Knowhow.`, active: 'themes/', body }));
}

function pageMagazines() {
  const r = '../';
  const series = uniq(magazines.map((m) => m.series));
  const body = `
<section class="page-head wrap">
  ${crumbs([[null, 'Magazines PDF']], r)}
  <h1>Magazines à télécharger</h1>
  <p class="lead">Toutes les éditions de Swiss Knowhow en PDF intégral. Cliquez sur une couverture pour voir le sommaire, ou téléchargez directement.</p>
</section>
<section class="wrap">
  <div class="filters" data-filters>
    <div class="filter-search">${icon('search')}<input type="search" placeholder="Filtrer les magazines…" data-filter-q aria-label="Filtrer"></div>
    <div class="seg" data-filter-series role="group" aria-label="Collection"><button type="button" data-v="" aria-pressed="true">Toutes</button>${series.map((s) => `<button type="button" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <span class="filter-count" data-filter-count></span>
  </div>
  <div class="mag-grid" data-list>${magazines.map((m) => magCard(m, r)).join('')}</div>
  <p class="empty" data-empty hidden>Aucun magazine.</p>
</section>`;
  write('magazines/index.html', layout({ depth: 1, title: 'Magazines PDF', description: `Téléchargez les ${magazines.length} éditions PDF de Swiss Knowhow.`, active: 'magazines/', body }));
}

function pageMagazine(m) {
  const r = '../../';
  const arts = m.articleSlugs.map((s) => artBySlug[s]).filter((a) => a && a.type !== 'annonce');
  const cos = m.companySlugs.map((s) => companyMap.get(s));
  const body = `
<section class="mag-hero">
  <div class="wrap mag-hero-inner">
    ${magCover(m, r, 'lg')}
    <div>
      ${crumbs([['magazines/', 'Magazines PDF'], [null, m.title]], r)}
      <p class="eyebrow">${esc(m.series || '')}${m.year ? ` · ${m.year}` : ''}${m.region ? ` · ${esc(m.region)}` : ''}</p>
      <h1>${esc(m.title)}</h1>
      ${m.description ? `<p class="lead">${esc(m.description)}</p>` : ''}
      <div class="chips">${m.themes.map((id) => themeChip(id, r)).join('')}</div>
      <div class="file-list">${m.files.map((f) => `<div class="file-row"><span>${icon('book')}<span><b>${esc(f.label || 'PDF intégral')}</b><span class="muted">${esc(f.name)}${f.sizeMB ? ` · ${f.sizeMB} Mo` : ''}</span></span></span><span class="file-actions"><a class="btn btn-primary btn-sm" href="${driveDownload(f.driveId)}" target="_blank" rel="noopener">${icon('download', 'ico sm')}Télécharger</a><a class="btn btn-ghost btn-sm" href="${driveView(f.driveId)}" target="_blank" rel="noopener">${icon('eye', 'ico sm')}Lire en ligne</a></span></div>`).join('')}</div>
    </div>
  </div>
</section>
${arts.length ? `<section class="wrap section">${sectionHead(`Sommaire · ${plural(arts.length, 'article', 'articles')}`, '', r)}<div class="grid grid-3">${arts.map((a) => articleCard(a, r, { showMag: false })).join('')}</div></section>` : ''}
${cos.length ? `<section class="wrap section">${sectionHead(`Entreprises de ce numéro · ${cos.length}`, '', r)}${filterBar({ withThemes: false })}<div class="grid grid-4" data-list>${cos.map((c) => companyCard(c, r)).join('')}</div><p class="empty" data-empty hidden>Aucun résultat.</p></section>` : ''}`;
  write(`magazines/${m.slug}/index.html`, layout({ depth: 2, title: m.title, description: m.description || m.title, active: 'magazines/', body, image: m.cover }));
}

function pageSearch() {
  const r = '../';
  const body = `
<section class="page-head wrap">
  ${crumbs([[null, 'Recherche']], r)}
  <h1>Recherche</h1>
  <form class="hero-search page-search" role="search" onsubmit="return false">${icon('search')}<input type="search" name="q" placeholder="Entreprise, personne, ville, thème, article…" aria-label="Rechercher" data-page-search autofocus autocomplete="off"></form>
</section>
<section class="wrap"><div class="search-page-results" data-page-results></div></section>`;
  write('recherche/index.html', layout({ depth: 1, title: 'Recherche', description: 'Rechercher dans l’annuaire Swiss Knowhow.', active: '', body }));
}

function page404() {
  const body = `<section class="page-head wrap"><h1>Page introuvable</h1><p class="lead">Cette page n'existe pas ou a été déplacée.</p><p><a class="btn btn-primary" href="./">Retour à l'accueil</a></p></section>`;
  write('404.html', layout({ depth: 0, title: 'Page introuvable', body }));
}

function searchIndex() {
  const idx = [];
  for (const c of companies) idx.push({ t: 'e', u: `entreprises/${c.slug}/`, n: c.name, d: [c.sector, location(c)].filter(Boolean).join(' · '), i: c.images?.[0] || '', th: c.themes[0] || '', k: [c.sector, c.city, c.canton, CANTONS[c.canton], c.contacts.map((p) => `${p.name} ${p.role || ''}`).join(' '), c.themes.map((t) => THEMES[t].label).join(' '), c.description].filter(Boolean).join(' ') });
  for (const a of articles) if (a.type !== 'annonce') idx.push({ t: 'a', u: `articles/${a.slug}/`, n: a.title, d: [TYPES[a.type], magBySlug[a.magazine]?.title].filter(Boolean).join(' · '), i: a.images?.[0] || '', th: a.themes[0] || '', k: [a.subtitle, a.region, (a.people || []).map((p) => `${p.name} ${p.role || ''}`).join(' '), a.themes.map((t) => THEMES[t].label).join(' '), a.summary].filter(Boolean).join(' ') });
  for (const m of magazines) idx.push({ t: 'm', u: `magazines/${m.slug}/`, n: m.title, d: [m.series, m.year].filter(Boolean).join(' · '), i: m.cover || '', th: m.themes[0] || '', k: [m.region, m.description, m.files.map((f) => f.name).join(' ')].filter(Boolean).join(' ') });
  for (const [id, t] of Object.entries(THEMES)) idx.push({ t: 't', u: `themes/${id}/`, n: t.label, d: 'Thème', i: '', th: id, k: '' });
  write('assets/search-index.json', JSON.stringify(idx));
  return idx.length;
}

// ---------- génération ----------
// Repart de zéro pour les pages générées (les assets statiques sont conservés)
for (const d of ['entreprises', 'articles', 'themes', 'magazines', 'recherche']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
pageHome();
pageCompanies();
companies.forEach(pageCompany);
pageArticles();
articles.forEach(pageArticle);
pageThemes();
Object.keys(THEMES).forEach(pageTheme);
pageMagazines();
magazines.forEach(pageMagazine);
pageSearch();
page404();
const n = searchIndex();
write('.nojekyll', '');
// Couleurs des thèmes pour le JS de recherche
write('assets/themes.json', JSON.stringify(Object.fromEntries(Object.entries(THEMES).map(([id, t]) => [id, { label: t.label, color: t.color }]))));
console.log(`Site généré : ${magazines.length} magazines, ${articles.length} articles, ${companies.length} entreprises, ${n} entrées de recherche → docs/`);
