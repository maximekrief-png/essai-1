// Swiss Knowhow — interactions : recherche instantanée, filtres, thème, menu, visionneuse.
(() => {
  const root = document.body.dataset.root || '';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- thème clair / sombre ----------
  $('[data-theme-toggle]')?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('skh-theme', next); } catch (e) { /* stockage indisponible */ }
  });

  // ---------- menu mobile ----------
  const menuBtn = $('[data-menu]');
  menuBtn?.addEventListener('click', () => {
    const nav = $('.main-nav');
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });

  // ---------- index de recherche ----------
  let index = null;
  let themes = {};
  let loading = null;
  const loadIndex = () => loading ||= Promise.all([
    fetch(root + 'assets/search-index.json').then((r) => r.json()),
    fetch(root + 'assets/themes.json').then((r) => r.json()).catch(() => ({})),
  ]).then(([idx, th]) => {
    themes = th;
    index = idx.map((d) => ({ ...d, fn: fold(d.n), fd: fold(d.d), fk: fold(d.k) }));
    return index;
  });

  const TYPE_LABEL = { e: 'Entreprises', a: 'Articles', m: 'Magazines', t: 'Thèmes' };
  const TYPE_ORDER = ['t', 'e', 'a', 'm'];

  // Mots vides ignorés dès que la requête contient d'autres mots
  const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux', 'en', 'un', 'une', 'sa', 'ag', 'der', 'die', 'das', 'und', 'von', 'the', 'of']);
  const queryTerms = (q) => {
    const all = fold(q).split(/[\s,;/'’-]+/).filter((t) => t.length > 0);
    const useful = all.filter((t) => !STOP.has(t));
    return useful.length ? useful : all;
  };

  function search(q, limit = 40) {
    const terms = queryTerms(q);
    if (!terms.length || !index) return [];
    const out = [];
    for (const d of index) {
      let score = 0;
      let ok = true;
      for (const t of terms) {
        let s = 0;
        if (d.fn === t) s = 120;
        else if (d.fn.startsWith(t)) s = 80;
        else if (new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(d.fn)) s = 60;
        else if (d.fn.includes(t)) s = 40;
        else if (d.fd.includes(t)) s = 22;
        else if (d.fk.includes(t)) s = 10;
        if (!s) { ok = false; break; }
        score += s;
      }
      if (!ok) continue;
      if (d.t === 't') score += 15;
      if (d.t === 'e') score += 4;
      out.push([score - d.n.length * 0.05, d]);
    }
    return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
  }

  const highlight = (text, q) => {
    let html = esc(text);
    const terms = queryTerms(q).filter((t) => t.length > 1);
    if (!terms.length) return html;
    const f = fold(text);
    const marks = [];
    for (const t of terms) { let i = f.indexOf(t); while (i >= 0) { marks.push([i, i + t.length]); i = f.indexOf(t, i + t.length); } }
    if (!marks.length) return html;
    marks.sort((a, b) => a[0] - b[0]);
    let res = '', pos = 0;
    for (const [s, e] of marks) { if (s < pos) continue; res += esc(text.slice(pos, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>'; pos = e; }
    return res + esc(text.slice(pos));
  };

  function itemHTML(d, q) {
    const th = themes[d.th] || { color: '#64748b' };
    const thumb = d.i
      ? `<span class="sr-thumb"><img src="${root}${esc(d.i)}" alt="" loading="lazy"></span>`
      : `<span class="sr-thumb ico-only" style="--c:${th.color}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${{ e: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>', a: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>', m: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5V4.5"/>', t: '<path d="M4 6h16M4 12h10M4 18h7"/>' }[d.t]}</svg></span>`;
    return `<a class="sr-item" href="${root}${d.u}">${thumb}<span class="sr-text"><b>${highlight(d.n, q)}</b><span>${esc(d.d)}</span></span></a>`;
  }

  function renderGrouped(results, q, container, { perGroup = 6 } = {}) {
    if (!q.trim()) {
      container.innerHTML = `<div class="sr-hint">Suggestions : ${['Horlogerie', 'Genève', 'Hôpital', 'Énergie', 'Bienne', 'Interview'].map((s) => `<a href="#" data-suggest="${s}">${s}</a>`).join('')}</div>`;
      return;
    }
    if (!results.length) { container.innerHTML = `<div class="sr-empty">Aucun résultat pour « ${esc(q)} »</div>`; return; }
    const groups = {};
    for (const r of results) (groups[r.t] ||= []).push(r);
    container.innerHTML = TYPE_ORDER.filter((t) => groups[t]).map((t) =>
      `<div class="sr-group">${TYPE_LABEL[t]} · ${groups[t].length}</div>` + groups[t].slice(0, perGroup).map((d) => itemHTML(d, q)).join('')
    ).join('');
  }

  // ---------- panneau de recherche (Ctrl K) ----------
  const overlay = $('[data-search-overlay]');
  const input = $('[data-search-input]');
  const results = $('[data-search-results]');
  let sel = -1;
  let lastFocus = null;

  const openSearch = (initial = '') => {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    input.value = initial;
    input.focus();
    loadIndex().then(() => update());
  };
  const closeSearch = () => {
    overlay.hidden = true;
    document.documentElement.style.overflow = '';
    lastFocus?.focus?.();
  };
  const update = () => {
    sel = -1;
    renderGrouped(search(input.value, 60), input.value, results);
  };
  const moveSel = (dir) => {
    const items = $$('.sr-item', results);
    if (!items.length) return;
    items[sel]?.removeAttribute('aria-selected');
    sel = (sel + dir + items.length) % items.length;
    items[sel].setAttribute('aria-selected', 'true');
    items[sel].scrollIntoView({ block: 'nearest' });
  };

  $$('[data-search-open]').forEach((b) => b.addEventListener('click', () => openSearch()));
  $('[data-search-close]')?.addEventListener('click', closeSearch);
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeSearch(); });
  input?.addEventListener('input', update);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') {
      const items = $$('.sr-item', results);
      const target = items[sel >= 0 ? sel : 0];
      if (target) location.href = target.href;
    }
  });
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-suggest]');
    if (!s) return;
    e.preventDefault();
    const field = s.closest('[data-page-results]') ? $('[data-page-search]') : input;
    field.value = s.dataset.suggest;
    field.dispatchEvent(new Event('input'));
    field.focus();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay.hidden ? openSearch() : closeSearch(); }
    else if (e.key === '/' && overlay.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape' && !overlay.hidden) closeSearch();
  });

  // Recherche de la page d'accueil : suggestions instantanées dans le panneau
  const hero = $('[data-hero-search]');
  hero?.addEventListener('input', () => { const v = hero.value; hero.value = ''; openSearch(v); update(); });
  hero?.addEventListener('focus', () => loadIndex());

  // Page /recherche/?q=
  const pageInput = $('[data-page-search]');
  if (pageInput) {
    const out = $('[data-page-results]');
    const params = new URLSearchParams(location.search);
    pageInput.value = params.get('q') || '';
    const run = () => {
      renderGrouped(search(pageInput.value, 200), pageInput.value, out, { perGroup: 200 });
      const u = new URL(location.href);
      pageInput.value ? u.searchParams.set('q', pageInput.value) : u.searchParams.delete('q');
      history.replaceState(null, '', u);
    };
    loadIndex().then(run);
    pageInput.addEventListener('input', run);
  }

  // ---------- filtres des listes ----------
  $$('[data-filters]').forEach((bar) => {
    const section = bar.parentElement;
    const list = $('[data-list]', section);
    if (!list) return;
    const items = [...list.children];
    const q = $('[data-filter-q]', bar);
    const theme = $('[data-filter-theme]', bar);
    const canton = $('[data-filter-canton]', bar);
    const type = $('[data-filter-type]', bar);
    const mag = $('[data-filter-mag]', bar);
    const noads = $('[data-filter-noads]', bar);
    const series = $('[data-filter-series]', bar);
    const letters = $('[data-letters]', section);
    const count = $('[data-filter-count]', bar);
    const empty = $('[data-empty]', section);
    let letter = '';
    let serie = '';
    const urlState = new URLSearchParams(location.search);
    if (theme && urlState.get('theme')) theme.value = urlState.get('theme');
    if (canton && urlState.get('canton')) canton.value = urlState.get('canton');

    const apply = () => {
      const terms = fold(q?.value).split(/\s+/).filter(Boolean);
      let n = 0;
      for (const el of items) {
        const d = el.dataset;
        const hay = d.q || '';
        const show = terms.every((t) => hay.includes(t))
          && (!theme?.value || (d.themes || '').split(' ').includes(theme.value))
          && (!canton?.value || d.canton === canton.value)
          && (!type?.value || d.type === type.value)
          && (!mag?.value || d.mag === mag.value)
          && (!letter || d.letter === letter)
          && (!serie || d.series === serie)
          && (!noads?.checked || !el.querySelector('.tag-muted'));
        el.hidden = !show;
        if (show) n++;
      }
      if (count) count.textContent = `${n} résultat${n > 1 ? 's' : ''}`;
      if (empty) empty.hidden = n > 0;
    };
    [q, theme, canton, type, mag, noads].forEach((el) => el?.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', apply));
    letters?.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      letter = b.dataset.letter;
      $$('button', letters).forEach((x) => x.setAttribute('aria-pressed', x === b));
      apply();
    });
    series?.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      serie = b.dataset.v;
      $$('button', series).forEach((x) => x.setAttribute('aria-pressed', x === b));
      apply();
    });
    apply();
  });

  // ---------- visionneuse d'images ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lightbox]');
    if (!a) return;
    e.preventDefault();
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `<img src="${a.getAttribute('href')}" alt="">`;
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    box.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
  });
})();
