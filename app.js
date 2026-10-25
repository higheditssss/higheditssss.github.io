// Pagina publica: profilurile membrilor (citire). Fiecare isi editeaza profilul din /settings (admin.html), dupa logare.
(function () {
  const { applyAccent, esc, STATUS, MONTHS, DAYS, parseDate, fmtDate, stars, heart, poster, watchTime, splitMinutes, histogram, api } = WL;
  const app = document.getElementById('app');

  let DB = null;
  let byId = new Map();

  // adrese curate, fara #: /<username>, /<username>/shows, /<username>/show/dexter-<id>
  const BASE = (document.querySelector('base') && document.querySelector('base').getAttribute('href')) || '/';
  const slug = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  let U = 'profil';
  const R = (p = '') => BASE + U + (p === '/' ? '' : p);
  const titleHref = (t) => R(`/${t.type === 'movie' ? 'movie' : 'show'}/${slug(t.title) || 'titlu'}-${t.id}`);
  // iconite SVG (in locul emoji-urilor)
  const ICONS = {"search":"<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/>","bell":"<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/>","home":"<path d=\"M3 10.5 12 3l9 7.5\"/><path d=\"M5 9.5V21h14V9.5\"/><path d=\"M10 21v-6h4v6\"/>","compass":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m15.5 8.5-2 5-5 2 2-5z\"/>","users":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>","user":"<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>","list":"<path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/>"};
  const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---------- date derivate ----------

  function diarySorted() {
    return [...DB.diary]
      .filter((e) => byId.has(e.titleId))
      .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
  }

  function scopeLabel(e, t) {
    if (e.season != null && e.episode != null) return `S${e.season} · E${e.episode}`;
    if (e.season != null) return `Sezonul ${e.season}`;
    return t.type === 'movie' ? 'Film' : 'Serial';
  }

  // cheia unei recenzii pentru comentarii: t = recenzia titlului, d = intrare din jurnal
  const reviewKey = (kind, id) => `${DB.uid}_${kind}_${id}`;
  const commentsSlot = (key, t) => (key && DB.uid ? `<div class="cmts" data-target="${esc(key)}" data-title-id="${esc(t.id)}" data-title="${esc(t.title)}"></div>` : '');

  function allReviews() {
    const out = [];
    for (const t of DB.titles) {
      if (t.review && t.review.trim()) {
        out.push({ t, text: t.review, rating: t.rating, liked: t.liked, spoiler: t.spoiler, date: (t.updatedAt || t.addedAt || '').slice(0, 10), scope: '', key: reviewKey('t', t.id) });
      }
    }
    for (const e of DB.diary) {
      const t = byId.get(e.titleId);
      if (t && e.review && e.review.trim()) {
        out.push({ t, text: e.review, rating: e.rating, liked: e.liked, spoiler: e.spoiler, date: e.date, scope: scopeLabel(e, t), rewatch: e.rewatch, key: reviewKey('d', e.id) });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }

  function bannerUrl(active) {
    if (active === 'stats' && DB.profile.statsBanner) return DB.profile.statsBanner;
    if (DB.profile.banner) return DB.profile.banner;
    const pick = DB.titles.find((t) => t.favorite && t.backdrop)
      || diarySorted().map((e) => byId.get(e.titleId)).find((t) => t && t.backdrop)
      || DB.titles.find((t) => t.backdrop);
    return pick ? pick.backdrop : '';
  }

  // ---------- componente ----------

  function avatar() {
    const p = DB.profile;
    return p.avatar
      ? `<img class="avatar" src="${esc(p.avatar)}" alt="">`
      : `<div class="avatar">${esc((p.name || '?').trim().charAt(0).toUpperCase())}</div>`;
  }

  const tabs = () => [
    ['profil', 'Profil', R('/')],
    ['seriale', 'Seriale', R('/shows')],
    ['filme', 'Filme', R('/movies')],
    ['recenzii', 'Recenzii', R('/reviews')],
    ['likes', 'Aprecieri', R('/likes')],
    ['jurnal', 'Jurnal', R('/diary')],
    ['liste', 'Liste', R('/lists')],
    ['stats', 'Statistici', R('/stats')],
    ['prieteni', 'Prieteni', R('/friends')],
  ];

  function shell(active, content) {
    const p = DB.profile;
    const banner = bannerUrl(active);
    return `
      <div class="hero" style="${banner ? `background-image:url('${esc(banner)}')` : ''}"></div>
      <div class="container">
        <div class="profile-head">
          ${avatar()}
          <div>
            <h1>${esc(p.name)}</h1>
            <div class="sub">${p.username ? '@' + esc(p.username) + ' · ' : ''}Membru din ${fmtDate(p.joined)}</div>
            <div id="follow-slot" class="follow-slot"></div>
            ${p.bio ? `<div class="profile-bio">${esc(p.bio)}</div>` : ''}
          </div>
        </div>
        <nav class="tabs">${tabs().filter(([k]) => (k !== 'stats' || p.showStats !== false) && (k !== 'prieteni' || (p.following || []).length)).map(([k, label, href]) => `<a href="${href}" class="${k === active ? 'active' : ''}">${label}</a>`).join('')}</nav>
        <div class="page">${content}</div>
      </div>`;
  }

  function section(title, body, href) {
    return `<section class="section">
      <div class="section-head"><h2>${title}</h2>${href ? `<a class="see-all" href="${href}">Vezi tot ›</a>` : ''}</div>
      ${body}
    </section>`;
  }

  const empty = (msg) => `<div class="empty-state">${msg}</div>`;

  function sidebarStats() {
    const wt = watchTime(DB.titles);
    const tv = splitMinutes(wt.tvMin);
    const mv = splitMinutes(wt.movieMin);
    const ratings = DB.titles.map((t) => t.rating).filter(Boolean);
    const watched = DB.titles.filter((t) => t.status === 'watched').length;
    const watchlist = DB.titles.filter((t) => t.status === 'watchlist').length;
    return `
      <div class="card time-card">
        <h3>Timp petrecut la seriale</h3>
        <div class="big">${tv.months}l ${tv.days}z ${tv.hours}h</div>
        <div class="lbl">luni · zile · ore</div>
        <div class="big">${wt.episodes}</div>
        <div class="lbl">Episoade văzute</div>
        <div class="big">${mv.totalHours}h</div>
        <div class="lbl" style="margin:0">Petrecute la filme</div>
      </div>
      <div class="card">
        <h3>Statistici</h3>
        ${histogram(ratings)}
        <div class="stat-rows">
          <a href="${R('/shows?status=watched')}"><span class="ic">${WL.ic('eye')}</span>Văzute<span class="val">${watched}</span></a>
          <a href="${R('/shows?status=watchlist')}"><span class="ic">${WL.ic('clock')}</span>De văzut<span class="val">${watchlist}</span></a>
          <a href="${R('/reviews')}"><span class="ic">${WL.ic('star')}</span>Ratinguri<span class="val">${ratings.length + DB.diary.filter((e) => e.rating).length}</span></a>
          <a href="${R('/year/' + new Date().getFullYear())}"><span class="ic">${WL.ic('sparkle')}</span>Anul în seriale<span class="val">${new Date().getFullYear()}</span></a>
          <a href="${R('/stats')}"><span class="ic">${WL.ic('chart')}</span>Toate statisticile<span class="val">›</span></a>
        </div>
      </div>`;
  }

  function reviewItem(r, withPoster = true) {
    const t = r.t;
    return `<article class="review ${r.spoiler ? 'spoiler' : ''}" ${withPoster ? '' : 'style="grid-template-columns:minmax(0,1fr)"'}>
      ${withPoster ? poster(t, { href: titleHref(t), showMeta: false }) : ''}
      <div>
        <h3><a href="${titleHref(t)}">${esc(t.title)}</a> <small>${esc(t.year || '')}</small></h3>
        <div class="meta">
          ${stars(r.rating, 'accent')}${heart(r.liked)}
          ${r.scope ? `<span class="badge">${esc(r.scope)}</span>` : ''}
          ${r.rewatch ? `<span class="badge">${WL.ic('refresh')} revăzut</span>` : ''}
          ${r.spoiler ? '<span class="badge">spoiler — click ca să vezi</span>' : ''}
          <span>${fmtDate(r.date)}</span>
        </div>
        <div class="text">${esc(r.text)}</div>
        ${commentsSlot(r.key, t)}
      </div>
    </article>`;
  }

  function listCard(l) {
    const items = l.items.map((id) => byId.get(id)).filter(Boolean);
    return `<a class="list-card" href="${R('/list/' + l.id)}">
      <div class="stack">${items.slice(0, 5).map((t) => `<div class="s">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}</div>`).join('') || '<div class="s"></div>'}</div>
      <h3>${esc(l.name)}</h3>
      <p>${plural(items.length, 'titlu', 'titluri')}${l.description ? ' · ' + esc(l.description) : ''}</p>
    </a>`;
  }

  // ---------- pagini ----------

  function pageProfile() {
    const favs = (DB.profile.favorites || []).map((id) => byId.get(id)).filter(Boolean);
    const watching = DB.titles.filter((t) => t.status === 'watching');
    let recent = diarySorted().slice(0, 8).map((e) => {
      const t = byId.get(e.titleId);
      return poster({ ...t, rating: e.rating, liked: e.liked }, { href: titleHref(t) });
    });
    if (!recent.length) {
      recent = [...DB.titles].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 8)
        .map((t) => poster(t, { href: titleHref(t) }));
    }
    const reviews = allReviews().slice(0, 3);
    const lists = DB.lists.slice(-2).reverse();

    const main = `
      ${favs.length ? section('Favorite', `<div class="grid lg">${favs.map((t) => poster(t, { href: titleHref(t) })).join('')}</div>`) : ''}
      ${section('Mă uit acum', watching.length ? `<div class="row-scroll">${watching.map((t) => poster(t, { href: titleHref(t) })).join('')}</div>` : empty('Nimic în curs acum.'), R('/shows?status=watching'))}
      ${section('Activitate recentă', recent.length ? `<div class="row-scroll">${recent.join('')}</div>` : empty('Încă nu e nimic aici.'), R('/diary'))}
      ${reviews.length ? section('Recenzii recente', reviews.map((r) => reviewItem(r)).join(''), R('/reviews')) : ''}
      ${lists.length ? section('Liste', `<div class="list-cards">${lists.map(listCard).join('')}</div>`, R('/lists')) : ''}
    `;
    if (DB.profile.showStats === false) {
      const fc = friendsSidebarCard();
      return shell('profil', fc ? `<div class="layout"><aside class="sidebar">${fc}</aside><div>${main}</div></div>` : main);
    }
    return shell('profil', `<div class="layout"><aside class="sidebar">${sidebarStats()}${friendsSidebarCard()}</aside><div>${main}</div></div>`);
  }

  const SORTS = {
    recent: ['Adăugate recent', (a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')],
    updated: ['Actualizate recent', (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')],
    rating: ['Rating (mare → mic)', (a, b) => (b.rating || 0) - (a.rating || 0)],
    title: ['Titlu (A → Z)', (a, b) => a.title.localeCompare(b.title, 'ro')],
    year: ['An apariție (nou → vechi)', (a, b) => (b.year || '').localeCompare(a.year || '')],
  };

  function pageLibrary(type, q) {
    const base = DB.titles.filter((t) => t.type === type);
    const status = q.get('status') || 'all';
    const sort = SORTS[q.get('sort')] ? q.get('sort') : 'recent';
    const route = type === 'tv' ? R('/shows') : R('/movies');
    const link = (s, so = sort) => `${route}?status=${s}&sort=${so}`;
    const items = base.filter((t) => status === 'all' || t.status === status).sort(SORTS[sort][1]);
    const wt = watchTime(base);

    const counts = type === 'tv'
      ? `<div><b>${base.length}</b><span>seriale</span></div><div><b>${wt.seasons}</b><span>sezoane</span></div><div><b>${wt.episodes}</b><span>episoade</span></div>`
      : `<div><b>${base.length}</b><span>filme</span></div><div><b>${base.filter((t) => t.status === 'watched').length}</b><span>văzute</span></div><div><b>${splitMinutes(wt.movieMin).totalHours}</b><span>ore</span></div>`;

    const filters = [['all', { short: 'Toate', icon: WL.ic('grid') }], ...Object.entries(STATUS)]
      .filter(([k]) => k === 'all' || type === 'tv' || base.some((t) => t.status === k) || k === 'watched' || k === 'watchlist')
      .map(([k, s]) => {
        const n = k === 'all' ? base.length : base.filter((t) => t.status === k).length;
        return `<a href="${link(k)}" class="${status === k ? 'active' : ''}"><span>${s.icon}</span>${k === 'watching' && type === 'tv' ? 'Mă uit acum' : s.short}<span class="n">${n}</span></a>`;
      }).join('');

    const side = `<div class="card">
        <div class="counts">${counts}</div>
        <div class="filter-list">${filters}</div>
        <label class="label-sm" for="sort">Sortează după</label>
        <select id="sort" class="select" data-route="${route}" data-status="${status}">
          ${Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>`;

    const grid = items.length
      ? `<div class="grid">${items.map((t) => poster(t, { href: titleHref(t) })).join('')}</div>`
      : empty(type === 'tv' ? 'Niciun serial aici.' : 'Niciun film aici.');

    return shell(type === 'tv' ? 'seriale' : 'filme', `<div class="layout lib-layout"><aside class="sidebar">${side}</aside><div>${grid}</div></div>`);
  }

  function pageReviews() {
    const reviews = allReviews();
    return shell('recenzii', reviews.length ? reviews.map((r) => reviewItem(r)).join('') : empty('Nicio recenzie încă.'));
  }

  function pageLikes() {
    const liked = DB.titles.filter((t) => t.liked).sort(SORTS.updated[1]);
    return shell('likes', liked.length ? `<div class="grid">${liked.map((t) => poster(t, { href: titleHref(t) })).join('')}</div>` : empty('Niciun titlu apreciat încă.'));
  }

  function pageDiary(q) {
    const filter = q.get('tip') || 'all';
    const entries = diarySorted().filter((e) => filter === 'all' || byId.get(e.titleId).type === filter);
    const groups = new Map();
    for (const e of entries) {
      const d = parseDate(e.date);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const head = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <select class="select" style="width:180px" id="diary-filter">
        <option value="all" ${filter === 'all' ? 'selected' : ''}>Toate</option>
        <option value="tv" ${filter === 'tv' ? 'selected' : ''}>Doar seriale</option>
        <option value="movie" ${filter === 'movie' ? 'selected' : ''}>Doar filme</option>
      </select></div>`;
    const body = [...groups].map(([month, list]) => `
      <h2 class="month-head">${month}</h2>
      <div class="diary-box">${list.map((e) => {
        const t = byId.get(e.titleId);
        const d = parseDate(e.date);
        return `<a class="diary-row" href="${titleHref(t)}">
          <div class="diary-day"><b>${d.getDate()}</b><span>${DAYS[d.getDay()]}</span></div>
          <div class="thumb">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}</div>
          <div style="min-width:0"><div class="diary-title">${esc(t.title)}</div><div class="diary-sub">${esc(scopeLabel(e, t))}${t.year ? ' · ' + esc(t.year) : ''}</div></div>
          <div class="diary-flags">${e.rewatch ? `<span title="Revăzut">${WL.ic('refresh')}</span>` : ''}${e.review ? '<span title="Are recenzie">≡</span>' : ''}${stars(e.rating, 'accent')}${heart(e.liked)}</div>
        </a>`;
      }).join('')}</div>`).join('');
    return shell('jurnal', head + (body || empty('Jurnalul e gol.')));
  }

  function pageLists() {
    const lists = [...DB.lists].reverse();
    return shell('liste', lists.length ? `<div class="list-cards">${lists.map(listCard).join('')}</div>` : empty('Nicio listă încă.'));
  }

  function pageList(id) {
    const l = DB.lists.find((x) => x.id === id);
    if (!l) return shell('liste', empty('Lista nu există.'));
    const items = l.items.map((i) => byId.get(i)).filter(Boolean);
    return shell('liste', `
      <div style="margin-bottom:22px">
        <a class="see-all" href="${R('/lists')}">‹ Toate listele</a>
        <h2 style="font-size:28px;margin-top:6px">${esc(l.name)}</h2>
        <div class="muted" style="font-size:13px;margin:4px 0 8px">${plural(items.length, 'titlu', 'titluri')}${l.ranked ? ' · listă clasament' : ''}</div>
        ${l.description ? `<p style="white-space:pre-line;max-width:760px;color:#d3d8dd">${esc(l.description)}</p>` : ''}
      </div>
      ${items.length ? `<div class="grid">${items.map((t, i) => poster(t, { href: titleHref(t), rank: l.ranked ? i + 1 : 0 })).join('')}</div>` : empty('Lista e goală.')}`);
  }

  function pageStats() {
    const T = DB.titles;
    const wt = watchTime(T);
    const tv = splitMinutes(wt.tvMin);
    const ratings = T.map((t) => t.rating).filter(Boolean);
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '—';

    const genres = new Map();
    T.filter((t) => t.status !== 'watchlist').forEach((t) => (t.genres || []).forEach((g) => genres.set(g, (genres.get(g) || 0) + 1)));
    const topGenres = [...genres].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const gMax = Math.max(1, ...topGenres.map((g) => g[1]));

    // activitate pe ultimele 12 luni (din jurnal)
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: MONTHS[d.getMonth()].slice(0, 3), n: DB.diary.filter((e) => e.date.startsWith(key)).length });
    }
    const mMax = Math.max(1, ...months.map((m) => m.n));

    const decades = new Map();
    T.filter((t) => t.year && t.status !== 'watchlist').forEach((t) => {
      const dec = Math.floor(Number(t.year) / 10) * 10 + 's';
      decades.set(dec, (decades.get(dec) || 0) + 1);
    });
    const decList = [...decades].sort((a, b) => a[0].localeCompare(b[0]));
    const dMax = Math.max(1, ...decList.map((d) => d[1]));

    const topRated = [...T].filter((t) => t.rating).sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)).slice(0, 12);

    const hbars = (rows, max) => rows.length
      ? `<div class="hbars">${rows.map(([k, n]) => `<div class="hbar"><span>${esc(k)}</span><div class="track"><div style="width:${(n / max) * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}</div>`
      : '<div class="muted">Nu sunt date încă.</div>';

    const yr = String(new Date().getFullYear());
    return shell('stats', `
      <a class="yr-promo" href="${R('/year/' + yr)}"><span class="yr-promo-ic">${WL.ic('sparkle')}</span>
        <span><b>${backend.user && backend.user.uid === DB.uid ? 'Anul tău în seriale' : 'Anul în seriale'} · ${yr}</b><small>Orele, topurile și momentele anului, într-o singură pagină.</small></span><span class="arrow">›</span></a>
      <div class="big-stats">
        <div class="card"><b>${T.filter((t) => t.type === 'tv').length}</b><span>Seriale</span></div>
        <div class="card"><b>${T.filter((t) => t.type === 'movie').length}</b><span>Filme</span></div>
        <div class="card"><b>${wt.episodes}</b><span>Episoade văzute</span></div>
        <div class="card"><b>${tv.totalHours}h</b><span>La seriale (${tv.months}l ${tv.days}z ${tv.hours}h)</span></div>
        <div class="card"><b>${splitMinutes(wt.movieMin).totalHours}h</b><span>La filme</span></div>
        <div class="card"><b>${avg}</b><span>Rating mediu</span></div>
        <div class="card"><b>${DB.diary.length}</b><span>Intrări în jurnal</span></div>
        <div class="card"><b>${allReviews().length}</b><span>Recenzii</span></div>
      </div>
      <div class="two-col">
        <div class="card"><h3>Distribuția ratingurilor</h3>${histogram(ratings)}</div>
        <div class="card"><h3>Activitate (ultimele 12 luni)</h3>
          <div class="vbars">${months.map((m) => `<div class="col" title="${m.n}"><div style="height:${(m.n / mMax) * 85}%"></div><span>${m.label}</span></div>`).join('')}</div>
        </div>
        <div class="card"><h3>Genuri preferate</h3>${hbars(topGenres, gMax)}</div>
        <div class="card"><h3>Pe decenii</h3>${hbars(decList, dMax)}</div>
      </div>
      <div style="margin-top:30px">${section('Cele mai bine notate', topRated.length ? `<div class="grid">${topRated.map((t) => poster(t, { href: titleHref(t) })).join('')}</div>` : empty('Încă nu ai dat note.'))}</div>
    `);
  }

  // ---------- anul in seriale (/<username>/year/2026): rezumatul unui an, din jurnal ----------

  // cat valoreaza o intrare din jurnal: un episod, un sezon intreg sau un film
  function entryWeight(e, t) {
    const rt = t.runtime || (t.type === 'movie' ? 100 : 45);
    if (t.type === 'movie') return { eps: 0, min: rt };
    if (e.episode == null && e.season != null) {
      const s = (t.seasons || []).find((x) => x.number === Number(e.season));
      const n = (s && s.episodes) || 1;
      return { eps: n, min: n * rt };
    }
    return { eps: 1, min: rt };
  }

  function pageYear(yParam) {
    const years = [...new Set(DB.diary.map((e) => String(e.date).slice(0, 4)))].filter((y) => /^\d{4}$/.test(y)).sort().reverse();
    const year = /^\d{4}$/.test(yParam || '') ? yParam : String(new Date().getFullYear());
    const entries = DB.diary.filter((e) => String(e.date).startsWith(year) && byId.has(e.titleId)).sort((a, b) => a.date.localeCompare(b.date));
    const mine = backend.user && backend.user.uid === DB.uid;
    const chips = years.length > 1 ? `<div class="yr-years">${years.map((y) => `<a href="${R('/year/' + y)}" class="${y === year ? 'on' : ''}">${y}</a>`).join('')}</div>` : '';
    const hero = (inner) => `<div class="yr-hero"><span class="yr-kicker">${WL.ic('sparkle')}${mine ? 'Anul tău în seriale' : 'Anul în seriale'}</span>
        <h2>${year}</h2>${inner}</div>${chips}`;
    if (!entries.length) return shell('stats', hero(`<p>${mine ? 'N-ai' : 'N-a'} notat nimic în jurnal în ${year}.</p>`));

    let minutes = 0;
    let episodes = 0;
    const per = new Map();
    const months = Array(12).fill(0);
    const weekdays = Array(7).fill(0);
    const perDay = new Map();
    for (const e of entries) {
      const t = byId.get(e.titleId);
      const w = entryWeight(e, t);
      minutes += w.min;
      episodes += w.eps;
      const d = parseDate(e.date);
      months[d.getMonth()]++;
      weekdays[d.getDay()]++;
      const day = perDay.get(e.date) || { eps: 0, movies: 0 };
      if (t.type === 'movie') day.movies++; else day.eps += w.eps;
      perDay.set(e.date, day);
      if (!per.has(t.id)) per.set(t.id, { t, n: 0, eps: 0, best: 0 });
      const p = per.get(t.id);
      p.n++;
      p.eps += w.eps;
      p.best = Math.max(p.best, e.rating || 0, t.rating || 0);
    }
    const all = [...per.values()];
    const shows = all.filter((p) => p.t.type === 'tv').sort((a, b) => b.eps - a.eps || b.best - a.best);
    const movies = all.filter((p) => p.t.type === 'movie').sort((a, b) => b.best - a.best || b.n - a.n);
    const ratings = entries.map((e) => e.rating).filter(Boolean);
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';
    const reviews = allReviews().filter((r) => r.date.startsWith(year)).length;
    const hours = Math.round(minutes / 60);

    const genres = new Map();
    all.forEach((p) => (p.t.genres || []).forEach((g) => genres.set(g, (genres.get(g) || 0) + p.n)));
    const topGenres = [...genres].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const gMax = Math.max(1, ...topGenres.map((g) => g[1]));
    const mMax = Math.max(1, ...months);
    const bestMonth = months.indexOf(Math.max(...months));
    const bestDay = weekdays.indexOf(Math.max(...weekdays));
    const [bigDate, big] = [...perDay].sort((a, b) => (b[1].eps + b[1].movies) - (a[1].eps + a[1].movies))[0];
    const bigText = [big.eps ? plural(big.eps, 'episod', 'episoade') : '', big.movies ? plural(big.movies, 'film', 'filme') : ''].filter(Boolean).join(' și ');
    const topRated = all.filter((p) => p.best).sort((a, b) => b.best - a.best || b.n - a.n)[0];
    const first = entries[0];
    const last = entries[entries.length - 1];
    const fact = (label, value, sub = '') => `<div class="card yr-fact"><span class="label-sm">${label}</span><b>${value}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
    const ranked = (list, n) => `<div class="grid">${list.slice(0, n).map((p, i) => poster({ ...p.t, rating: p.best }, { href: titleHref(p.t), rank: i + 1 })).join('')}</div>`;

    return shell('stats', `
      ${hero(`<p>${hours === 1 ? '1 oră' : hours % 100 >= 20 || hours >= 100 && hours % 100 === 0 ? hours + ' de ore' : hours + ' ore'} în fața ecranului, ${plural(per.size, 'titlu', 'titluri')} și ${plural(entries.length, 'intrare', 'intrări')} în jurnal.</p>
        <button type="button" class="btn small" id="yr-share">${WL.ic('share')}Distribuie</button>`)}
      <div class="big-stats">
        <div class="card"><b>${hours}h</b><span>Ore de privit</span></div>
        <div class="card"><b>${episodes}</b><span>Episoade</span></div>
        <div class="card"><b>${shows.length}</b><span>Seriale</span></div>
        <div class="card"><b>${movies.length}</b><span>Filme</span></div>
        <div class="card"><b>${avg}</b><span>Nota medie</span></div>
        <div class="card"><b>${reviews}</b><span>Recenzii scrise</span></div>
      </div>
      <div class="yr-facts">
        ${topRated ? fact('Cel mai bine notat', `<a class="notranslate" href="${titleHref(topRated.t)}">${esc(topRated.t.title)}</a>`, stars(topRated.best, 'accent')) : ''}
        ${shows[0] ? fact('Serialul anului', `<a class="notranslate" href="${titleHref(shows[0].t)}">${esc(shows[0].t.title)}</a>`, plural(shows[0].eps, 'episod', 'episoade')) : ''}
        ${fact('Luna cea mai activă', MONTHS[bestMonth], plural(months[bestMonth], 'intrare', 'intrări'))}
        ${fact('Ziua preferată', WEEKDAYS[bestDay], plural(weekdays[bestDay], 'intrare', 'intrări'))}
        ${fact('Maratonul anului', fmtDate(bigDate), bigText)}
        ${fact('Primul din an', `<a class="notranslate" href="${titleHref(byId.get(first.titleId))}">${esc(byId.get(first.titleId).title)}</a>`, fmtDate(first.date))}
        ${last !== first ? fact('Cel mai recent', `<a class="notranslate" href="${titleHref(byId.get(last.titleId))}">${esc(byId.get(last.titleId).title)}</a>`, fmtDate(last.date)) : ''}
      </div>
      <div class="two-col">
        <div class="card"><h3>Pe luni</h3>
          <div class="vbars">${months.map((n, i) => `<div class="col" title="${n}"><div style="height:${(n / mMax) * 85}%"></div><span>${MONTHS[i].slice(0, 3)}</span></div>`).join('')}</div>
        </div>
        <div class="card"><h3>Genuri</h3>${topGenres.length
          ? `<div class="hbars">${topGenres.map(([k, n]) => `<div class="hbar"><span>${esc(k)}</span><div class="track"><div style="width:${(n / gMax) * 100}%"></div></div><span class="n">${n}</span></div>`).join('')}</div>`
          : '<div class="muted">Nu sunt date încă.</div>'}</div>
      </div>
      ${shows.length ? `<div style="margin-top:30px">${section('Top seriale', ranked(shows, 10))}</div>` : ''}
      ${movies.length ? section('Top filme', ranked(movies, 10)) : ''}
      <p class="muted yr-note">Calculat din jurnal: un episod notat = un episod, un sezon notat = toate episoadele lui. Orele sunt aproximative.</p>`);
  }

  // butonul de trailer: logat, trailerul se deschide pe pagina; altfel, cautare pe YouTube
  const trailerSearch = (t) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${t.title} ${t.year || ''} trailer`);
  function trailerBtn(t) {
    if (!backend.user || !t.tmdbId) return `<a class="btn small trailer-btn" href="${esc(trailerSearch(t))}" target="_blank" rel="noopener">${WL.ic('play')}Trailer</a>`;
    return `<button type="button" class="btn small trailer-btn" data-trailer="${esc(t.type)}:${esc(t.tmdbId)}" data-search="${esc(trailerSearch(t))}">${WL.ic('play')}Trailer</button>`;
  }

  function pageTitle(id, actions = '') {
    const t = byId.get(id);
    if (!t) return shell('profil', empty('Titlul nu există.'));
    const isTv = t.type === 'tv';
    const entries = diarySorted().filter((e) => e.titleId === t.id);
    const inLists = DB.lists.filter((l) => l.items.includes(t.id));
    const st = STATUS[t.status] || STATUS.watched;

    const meta = [
      t.year,
      isTv ? (t.seasonsCount ? plural(t.seasonsCount, 'sezon', 'sezoane') : '') : '',
      t.runtime ? `${t.runtime}m` : '',
      (t.genres || []).join(', '),
    ].filter(Boolean).map(esc).join(' • ');

    const epsTotal = t.episodesCount || 0;
    const epsDone = t.status === 'watched' ? (t.episodesWatched || epsTotal) : (t.episodesWatched || 0);

    const myCard = `<div class="card my-card">
      <h3>Activitatea mea</h3>
      <div class="row"><span class="muted">Status</span><span class="badge accent">${st.icon} ${st.label}</span></div>
      ${t.rating ? `<div class="row"><span class="muted">Rating</span>${stars(t.rating, 'accent lg')}</div>` : ''}
      ${t.liked || t.favorite ? `<div class="row"><span class="muted">Marcaje</span><span>${t.liked ? `<span class="heart">${WL.ic('heart')}</span> Îmi place` : ''}${t.liked && t.favorite ? ' · ' : ''}${t.favorite ? `<span class="fav-ic">${WL.ic('star')}</span> Favorit` : ''}</span></div>` : ''}
      ${isTv && epsTotal ? `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between"><span class="muted">Episoade</span><span>${epsDone} / ${epsTotal}</span></div><div class="progress"><div style="width:${Math.min(100, (epsDone / epsTotal) * 100)}%"></div></div></div>` : ''}
      <div class="row"><span class="muted">Adăugat</span><span>${fmtDate(t.addedAt)}</span></div>
      ${t.note ? `<div class="row" style="display:block"><span class="muted">Notiță</span><div style="white-space:pre-line;margin-top:4px">${esc(t.note)}</div></div>` : ''}
    </div>`;

    const creators = (t.creators || []).length
      ? `<div class="card"><h3>${isTv ? 'Creat de' : 'Regia'}</h3>${t.creators.map(esc).join(', ')}${(t.networks || []).length ? `<div class="muted" style="margin-top:8px;font-size:13px">${t.networks.map(esc).join(', ')}</div>` : ''}</div>` : '';

    const listsCard = inLists.length
      ? `<div class="card"><h3>Apare în liste</h3>${inLists.map((l) => `<a href="${R('/list/' + l.id)}" style="display:block;padding:4px 0;color:var(--accent-text)">${esc(l.name)}</a>`).join('')}</div>` : '';

    const review = t.review
      ? section('Recenzia mea', reviewItem({ t, text: t.review, rating: t.rating, liked: t.liked, spoiler: t.spoiler, date: (t.updatedAt || '').slice(0, 10), scope: '', key: reviewKey('t', t.id) }, false))
      : '';

    const diary = entries.length
      ? section('Din jurnal', `<div class="diary-box">${entries.map((e) => {
          const d = parseDate(e.date);
          return `<div class="diary-row" style="grid-template-columns:54px minmax(0,1fr) auto">
            <div class="diary-day"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}</span></div>
            <div style="min-width:0"><div class="diary-title">${esc(scopeLabel(e, t))}${e.rewatch ? ` <span class="badge">${WL.ic('refresh')} revăzut</span>` : ''}</div>${e.review ? `<div class="diary-sub ${e.spoiler ? 'spoiler' : ''}"><div class="text">${esc(e.review)}</div></div>${commentsSlot(reviewKey('d', e.id), t)}` : ''}</div>
            <div class="diary-flags">${stars(e.rating, 'accent')}${heart(e.liked)}</div>
          </div>`;
        }).join('')}</div>`)
      : '';

    const seasons = isTv && (t.seasons || []).length
      ? section(`Sezoane (${t.seasons.filter((s) => s.number > 0).length})`, `<div class="card" style="padding:0">${t.seasons.map((s) => {
          const r = (t.seasonRatings || {})[String(s.number)];
          return `<div class="season-row">
            <div class="thumb">${s.poster ? `<img src="${esc(s.poster)}" alt="" loading="lazy">` : ''}</div>
            <div><b>${esc(s.name || 'Sezonul ' + s.number)}</b><div class="diary-sub">${s.airDate ? fmtDate(s.airDate) + ' · ' : ''}${plural(s.episodes, 'episod', 'episoade')}</div></div>
            <div>${r ? stars(r, 'accent') : ''}</div>
          </div>`;
        }).join('')}</div>`)
      : '';

    const cast = (t.cast || []).length
      ? section('Distribuție', `<div class="cast">${t.cast.map((c) => `<div><div class="face">${c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : ''}</div><b>${esc(c.name)}</b><span>${esc(c.character)}</span></div>`).join('')}</div>`)
      : '';

    return `
      <div class="hero title-hero" style="${t.backdrop ? `background-image:url('${esc(t.backdrop)}')` : ''}"></div>
      <div class="container">
        <div class="title-head">
          ${poster(t, { showMeta: false })}
          <div>
            <h1>${esc(t.title)}</h1>
            <div class="title-meta">${meta}</div>
            <div class="title-actions">${trailerBtn(t)}</div>
            ${t.tagline ? `<div class="tagline">${esc(t.tagline)}</div>` : ''}
            ${t.overview ? `<p class="overview">${esc(t.overview)}</p>` : ''}
          </div>
        </div>
        <div class="title-body page">
          <div>
            ${t.overview ? `<p class="overview mobile">${esc(t.overview)}</p>` : ''}
            ${review}${diary}${seasons}${cast}
            ${!review && !diary && !seasons && !cast ? empty('Nimic în plus de afișat.') : ''}
          </div>
          <aside class="sidebar">${actions || myCard}<div id="providers"></div>${creators}${listsCard}</aside>
        </div>
      </div>`;
  }

  function loadProviders(t) {
    const box = document.getElementById('providers');
    const d = t && t.providers;
    if (!d || d.none || !box) return;
    const group = (label, list) => list && list.length
      ? `<div class="prov-group"><span class="label-sm">${label}</span><div class="prov-logos">${list.map((x) => `<img src="${esc(x.logo)}" alt="${esc(x.name)}" title="${esc(x.name)}" loading="lazy">`).join('')}</div></div>` : '';
    const html = group('Abonament', d.flatrate) + group('Gratuit', d.free) + group('Închiriere', d.rent) + group('Cumpărare', d.buy);
    if (!html) return;
    box.innerHTML = `<div class="card"><h3>Unde poți viziona${d.region ? ' · ' + esc(d.region) : ''}</h3>${html}${d.link ? `<a class="see-all" style="display:inline-block;margin-top:10px" href="${esc(d.link)}" target="_blank" rel="noopener">Detalii ›</a>` : ''}<div class="hint" style="margin-top:8px;font-size:11px;color:var(--faint)">Sursa: JustWatch prin TMDB</div></div>`;
  }

  // ---------- comentarii la recenzii ----------
  // toate comentariile de pe un profil vin dintr-o singura cerere (dupa autorul recenziilor)

  async function fillComments() {
    const boxes = [...app.querySelectorAll('.cmts[data-target]')];
    if (!boxes.length) return;
    const owner = DB.uid;
    let list;
    let members;
    try {
      [list, members] = await Promise.all([backend.commentsFor(owner), backend.listMembers().catch(() => [])]);
    } catch { return; } // regulile Firebase pentru comentarii nu sunt puse inca: nu afisam nimic
    if (!boxes[0].isConnected) return;
    const people = new Map(members.map((p) => [p.uid, p]));
    const byTarget = new Map();
    for (const c of list) { if (!byTarget.has(c.target)) byTarget.set(c.target, []); byTarget.get(c.target).push(c); }
    for (const box of boxes) drawComments(box, owner, byTarget.get(box.dataset.target) || [], people);
  }

  function drawComments(box, owner, list, people, open = false) {
    const myUid = backend.user && backend.user.uid;
    const av = (c) => {
      const p = people.get(c.uid);
      return p && p.avatar ? `<img class="cmt-av" src="${esc(p.avatar)}" alt="" loading="lazy">`
        : `<span class="cmt-av" style="color:${esc((p && p.accent) || 'var(--accent)')}">${esc((c.name || c.username || '?').charAt(0).toUpperCase())}</span>`;
    };
    const who = (c) => (c.username ? `<a class="cmt-name" href="${BASE}${esc(c.username)}">${esc(c.name || c.username)}</a>` : `<span class="cmt-name">${esc(c.name || 'Membru')}</span>`);
    const n = list.length;
    if (!n && !myUid) { box.innerHTML = ''; return; }
    box.innerHTML = `<button type="button" class="cmt-toggle${open ? ' on' : ''}">${WL.ic('comment')}${n ? plural(n, 'comentariu', 'comentarii') : 'Comentează'}</button>
      <div class="cmt-body${open ? '' : ' hidden'}">
        ${list.map((c) => `<div class="cmt" data-id="${esc(c.id)}">${av(c)}
          <div class="cmt-main"><div class="cmt-head">${who(c)}<span class="muted">${fmtDate(String(c.createdAt).slice(0, 10))}</span>
            ${myUid && (c.uid === myUid || owner === myUid) ? `<button type="button" class="cmt-del" data-del="${esc(c.id)}" title="Șterge comentariul" aria-label="Șterge comentariul">${WL.ic('x')}</button>` : ''}</div>
            <div class="cmt-text">${esc(c.text)}</div></div></div>`).join('')}
        ${myUid ? `<form class="cmt-form"><textarea class="textarea" maxlength="2000" placeholder="Scrie un comentariu…" required></textarea><button class="btn small primary">Trimite</button></form>`
          : `<div class="muted cmt-login"><a href="login" style="color:var(--accent-text)">Intră în cont</a> ca să comentezi.</div>`}
      </div>`;
    box.onclick = async (e) => {
      if (e.target.closest('.cmt-toggle')) {
        box.querySelector('.cmt-toggle').classList.toggle('on');
        const b = box.querySelector('.cmt-body');
        b.classList.toggle('hidden');
        if (!b.classList.contains('hidden') && box.querySelector('textarea')) box.querySelector('textarea').focus();
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) {
        if (!confirm('Ștergi comentariul?')) return;
        del.disabled = true;
        try { await backend.deleteComment(del.dataset.del); } catch (err) { del.disabled = false; toast(err.message, true); return; }
        drawComments(box, owner, list.filter((c) => c.id !== del.dataset.del), people, true);
      }
    };
    const form = box.querySelector('.cmt-form');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const ta = form.querySelector('textarea');
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const c = await backend.addComment({ owner, target: box.dataset.target, titleId: box.dataset.titleId, title: box.dataset.title, text: ta.value });
        drawComments(box, owner, [...list, c], people, true);
      } catch (err) {
        btn.disabled = false;
        toast(err.code === 'permission-denied' ? 'Comentariile nu sunt pornite încă pe site.' : err.message, true);
      }
    };
  }

  // ---------- prieteni: cereri de prietenie ----------
  // A ii trimite cerere lui B = B apare in A.following. Prieteni = fiecare il are pe celalalt in following.

  const userCache = new Map();
  function loadFollowed(uid) {
    if (!userCache.has(uid)) userCache.set(uid, backend.loadUserByUid(uid).catch(() => null));
    return userCache.get(uid);
  }
  const userHome = (d) => BASE + d.profile.username;
  const userTitleHref = (d, t) => `${userHome(d)}/${t.type === 'movie' ? 'movie' : 'show'}/${slug(t.title) || 'titlu'}-${t.id}`;
  const userAvatar = (d, size = '') => (d.profile.avatar
    ? `<img class="avatar ${size}" src="${esc(d.profile.avatar)}" alt="" loading="lazy">`
    : `<div class="avatar ${size}" style="${d.profile.accent ? `color:${esc(d.profile.accent)}` : ''}">${esc((d.profile.name || d.profile.username || '?').charAt(0).toUpperCase())}</div>`);

  // prietenii (reciproci) ai unui profil incarcat
  async function friendsOf(d) {
    const list = await Promise.all((d.profile.following || []).map(loadFollowed));
    return list.filter((x) => x && !x.private && x.profile.username && (x.profile.following || []).includes(d.uid));
  }

  function friendsSidebarCard() {
    if (!(DB.profile.following || []).length) return '';
    return `<div class="card" id="friends-card"><h3>Prieteni <span id="friend-count"></span></h3><div class="friend-dots" id="friend-dots"><div class="avatar sm"></div><div class="avatar sm"></div></div>
      <a class="see-all" style="display:inline-block;margin-top:12px" href="${R('/friends')}">Vezi prietenii ›</a></div>`;
  }

  async function fillFriendsSidebar() {
    const box = document.getElementById('friend-dots');
    if (!box) return;
    const list = await friendsOf(DB);
    if (!box.isConnected) return;
    if (!list.length) { document.getElementById('friends-card').remove(); return; }
    document.getElementById('friend-count').textContent = '· ' + list.length;
    box.innerHTML = list.map((d) => `<a href="${esc(userHome(d))}" title="${esc(d.profile.name)}">${userAvatar(d, 'sm')}</a>`).join('');
  }

  function pageFriends() {
    if (!(DB.profile.following || []).length) return shell('prieteni', empty('Nu are prieteni încă.'));
    return shell('prieteni', `<div class="friend-cards" id="friend-cards"><div class="card friend-card skeleton"></div><div class="card friend-card skeleton"></div></div>`);
  }

  async function fillFriendsPage() {
    const cards = document.getElementById('friend-cards');
    if (!cards) return;
    const list = await friendsOf(DB);
    if (!cards.isConnected) return;
    cards.innerHTML = list.map((d) => {
      const tv = d.titles.filter((t) => t.type === 'tv').length;
      const mv = d.titles.filter((t) => t.type === 'movie').length;
      return `<a class="card friend-card" href="${esc(userHome(d))}" style="--friend:${esc(d.profile.accent || 'var(--accent)')}">
        ${userAvatar(d)}
        <div style="min-width:0"><b>${esc(d.profile.name)}</b>
          <span class="muted">@${esc(d.profile.username)} · ${tv} seriale · ${mv} filme · ${d.diary.length} în jurnal</span></div>
        <span class="arrow">›</span></a>`;
    }).join('') || empty('Nu are prieteni încă.');
  }

  // activitatea recenta a unor profiluri, amestecata, cea mai noua prima
  function renderFeed(box, people, max, title) {
    if (!box) return;
    const feed = [];
    for (const d of people) {
      const titles = new Map(d.titles.map((t) => [t.id, t]));
      for (const e of d.diary) { const t = titles.get(e.titleId); if (t) feed.push({ d, e, t }); }
    }
    feed.sort((a, b) => (b.e.date + (b.e.createdAt || '')).localeCompare(a.e.date + (a.e.createdAt || '')));
    if (!feed.length) { box.innerHTML = title ? '' : empty('Prietenii tăi n-au notat nimic încă.'); return; }
    const rows = `<div class="diary-box">${feed.slice(0, max).map(({ d, e, t }) => `
      <a class="diary-row" href="${esc(userTitleHref(d, t))}">
        <div class="diary-day">${userAvatar(d, 'xs')}</div>
        <div class="thumb">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}</div>
        <div style="min-width:0"><div class="diary-title">${esc(t.title)}</div>
          <div class="diary-sub">${esc(d.profile.name)} · ${esc(scopeLabel(e, t))} · ${fmtDate(e.date)}</div></div>
        <div class="diary-flags">${e.rewatch ? `<span title="Revăzut">${WL.ic('refresh')}</span>` : ''}${e.review ? '<span title="Are recenzie">≡</span>' : ''}${stars(e.rating, 'accent')}${heart(e.liked)}</div>
      </a>`).join('')}</div>`;
    box.innerHTML = title ? section(title, rows) : rows;
  }

  // relatia dintre mine si alt profil
  function relation(me, other) {
    const myUid = backend.user.uid;
    const iSent = (me.profile.following || []).includes(other.uid);
    const theySent = (other.profile ? other.profile.following || [] : other.following || []).includes(myUid);
    const declined = (me.profile.declined || []).includes(other.uid);
    if (iSent && theySent) return 'friends';
    if (iSent) return 'sent';
    if (theySent && !declined) return 'received';
    return 'none';
  }

  // schimba relatia: add (cerere / acceptare), cancel (anulare / stergere prieten), decline (refuz)
  async function setRelation(me, uid, action) {
    let following = [...(me.profile.following || [])];
    let declined = [...(me.profile.declined || [])];
    if (action === 'add') { following.push(uid); declined = declined.filter((x) => x !== uid); }
    if (action === 'cancel') { following = following.filter((x) => x !== uid); declined.push(uid); }
    if (action === 'decline') declined.push(uid);
    me.profile = await api('/api/profile', { method: 'PUT', body: { following: [...new Set(following)], declined: [...new Set(declined)] } });
    userCache.clear();
    updateRequestBadge();
  }

  // butonul de prietenie de langa nume
  async function fillFollowButton() {
    const slot = document.getElementById('follow-slot');
    if (!slot || !backend.user) return;
    if (backend.user.uid === DB.uid) {
      slot.innerHTML = `<a class="btn small" href="settings">${WL.ic('pen')}Editează profilul</a>`;
      return;
    }
    let me;
    try { me = await api('/api/public'); } catch { return; }
    if (!slot.isConnected) return;
    const target = { uid: DB.uid, profile: DB.profile };
    const draw = () => {
      const rel = relation(me, target);
      const buttons = {
        friends: `<button class="btn small" data-act="cancel" data-confirm="1">${WL.ic('check')}Prieteni</button>`,
        sent: '<button class="btn small" data-act="cancel">Cerere trimisă · Anulează</button>',
        received: `<button class="btn small primary" data-act="add">${WL.ic('check')}Acceptă cererea</button><button class="btn small ghost" data-act="decline">Refuză</button>`,
        none: '<button class="btn small primary" data-act="add">+ Adaugă prieten</button>',
      };
      slot.innerHTML = `<div class="follow-btns">${buttons[rel]}</div>`;
    };
    draw();
    slot.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.confirm && !confirm(`Îl scoți pe ${DB.profile.name} de la prieteni?`)) return;
      b.disabled = true;
      try { await setRelation(me, DB.uid, b.dataset.act); } catch (e) { alert(e.message); }
      draw();
    });
  }

  // ---------- clopotelul de notificari ----------
  // cereri primite (cu Accepta / Refuza) + prietenii noi; ce ai vazut se tine minte in browser

  const seenKey = () => 'editsel_seen_' + backend.user.uid;
  const getSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch { return new Set(); } };
  const saveSeen = (set) => { try { localStorage.setItem(seenKey(), JSON.stringify([...set].slice(-500))); } catch { /* fara memorie locala */ } };
  let notifState = { items: [], me: null, members: [] };

  async function loadNotifications() {
    const myUid = backend.user.uid;
    const [members, me, comments] = await Promise.all([
      backend.listMembers().catch(() => []), api('/api/public').catch(() => null), backend.commentsFor(myUid).catch(() => []),
    ]);
    if (!me) return null;
    const others = members.filter((p) => p.username && p.uid !== myUid);
    const items = [];
    for (const p of others) {
      const rel = relation(me, p);
      if (rel === 'received') items.push({ id: 'r:' + p.uid, type: 'request', p });
      if (rel === 'friends') items.push({ id: 'f:' + p.uid, type: 'friend', p });
    }
    // comentariile altora la recenziile mele, din ultimele 60 de zile (cele mai noi primele)
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    comments.filter((c) => c.uid !== myUid && c.createdAt > since).reverse().slice(0, 20).forEach((c) => {
      const p = others.find((x) => x.uid === c.uid) || { uid: c.uid, username: c.username, name: c.name, avatar: '', accent: '' };
      items.push({ id: 'c:' + c.id, type: 'comment', p, c });
    });
    // cererile primite sunt mereu sus, apoi comentariile, apoi prieteniile noi
    const order = { request: 0, comment: 1, friend: 2 };
    items.sort((a, b) => order[a.type] - order[b.type]);
    notifState = { items, me, members: others };
    return notifState;
  }

  function setBellCount(n) {
    const bell = document.getElementById('bell');
    if (!bell) return;
    if (n > 0) bell.setAttribute('data-badge', n); else bell.removeAttribute('data-badge');
  }

  async function updateRequestBadge() {
    const links = document.querySelectorAll('.main-nav a[data-nav="prieteni"], .bottom-nav a[data-nav="prieteni"]');
    if (!backend || !backend.user) { links.forEach((a) => a.removeAttribute('data-badge')); return; }
    const st = await loadNotifications();
    if (!st) return;
    const requests = st.items.filter((n) => n.type === 'request').length;
    links.forEach((a) => (requests ? a.setAttribute('data-badge', requests) : a.removeAttribute('data-badge')));
    const seen = getSeen();
    setBellCount(st.items.filter((n) => n.type === 'request' || !seen.has(n.id)).length);
  }

  function drawBellPanel() {
    const panel = document.getElementById('bell-panel');
    if (!panel) return;
    const seen = getSeen();
    const av = (p) => (p.avatar ? `<img class="hs-avatar" src="${esc(p.avatar)}" alt="">` : `<span class="hs-avatar" style="color:${esc(p.accent || 'var(--accent)')}">${esc((p.name || p.username).charAt(0).toUpperCase())}</span>`);
    const list = notifState.items.slice(0, 30);
    panel.innerHTML = `<div class="bell-head">Notificări</div>${list.length ? list.map((n) => `
      <div class="bell-item ${n.type === 'request' || !seen.has(n.id) ? 'new' : ''}" data-uid="${esc(n.p.uid)}">
        <a href="${BASE}${esc(n.p.username)}">${av(n.p)}</a>
        <div class="bell-text">
          ${n.type === 'request'
            ? `<a href="${BASE}${esc(n.p.username)}"><b>${esc(n.p.name || n.p.username)}</b></a> ți-a trimis o cerere de prietenie.
               <div class="follow-btns"><button class="btn small primary" data-act="add">${WL.ic('check')}Acceptă</button><button class="btn small ghost" data-act="decline">Refuză</button></div>`
            : n.type === 'comment'
              ? `<a href="${BASE}${esc(n.p.username)}"><b>${esc(n.p.name || n.p.username)}</b></a> a comentat la recenzia ta pentru <a href="${BASE}${esc(notifState.me.profile.username)}/show/${slug(n.c.title) || 'titlu'}-${esc(n.c.titleId)}"><b class="notranslate">${esc(n.c.title)}</b></a>:
                 <div class="bell-quote notranslate">„${esc(n.c.text.length > 120 ? n.c.text.slice(0, 120) + '…' : n.c.text)}”</div>`
              : `Tu și <a href="${BASE}${esc(n.p.username)}"><b>${esc(n.p.name || n.p.username)}</b></a> sunteți acum prieteni.`}
        </div>
      </div>`).join('') : '<div class="hs-empty">Nu ai notificări.</div>'}
      <a class="hs-all" href="${BASE}friends">Toți prietenii ›</a>`;
  }

  function setupBell() {
    const bell = document.getElementById('bell');
    const panel = document.getElementById('bell-panel');
    if (!bell || !panel) return;
    bell.addEventListener('click', async (e) => {
      e.stopPropagation();
      const opening = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !opening);
      if (!opening) return;
      panel.innerHTML = '<div class="hs-empty">Se încarcă…</div>';
      await updateRequestBadge();
      drawBellPanel();
      // prieteniile noi si comentariile se considera vazute odata ce deschizi clopotelul
      const seen = getSeen();
      notifState.items.filter((n) => n.type !== 'request').forEach((n) => seen.add(n.id));
      saveSeen(seen);
      setBellCount(notifState.items.filter((n) => n.type === 'request').length);
    });
    panel.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target.closest('button[data-act]');
      if (btn) {
        btn.disabled = true;
        try { await setRelation(notifState.me, btn.closest('[data-uid]').dataset.uid, btn.dataset.act); } catch (err) { alert(err.message); }
        await updateRequestBadge();
        drawBellPanel();
        if (location.pathname.startsWith(BASE + 'friends')) render();
        return;
      }
      if (e.target.closest('a')) panel.classList.add('hidden');
    });
    document.addEventListener('click', () => panel.classList.add('hidden'));
  }

  // ---------- antet: cont ----------

  // fara buton Membri in meniu (pagina /members ramane, cu link din subsol);
  // logat, prima pagina e Descopera: butoanele Acasa/Descopera nu mai au rost (se ajunge acolo din logo)
  function swapNav(logged) {
    // pe telefon, logat, primul buton devine Descopera (pe PC se ajunge acolo din logo)
    const home = document.getElementById('bn-home');
    const disc = document.getElementById('bn-disc');
    if (home) {
      home.dataset.nav = logged ? 'descopera' : 'acasa';
      home.setAttribute('href', logged ? 'discover' : './');
      home.innerHTML = `<span>${icon(logged ? 'compass' : 'home')}</span>${logged ? 'Descoperă' : 'Acasă'}`;
    }
    if (disc) disc.hidden = logged;
    document.querySelectorAll('.main-nav a[data-nav="descopera"]').forEach((a) => { a.hidden = logged; });
  }

  function authSlotHtml(p) {
    const username = p.username || '';
    return `<div class="bell-wrap"><button class="bell" id="bell" type="button" aria-label="Notificări">${icon('bell')}</button><div class="bell-panel hidden" id="bell-panel"></div></div>${username ? `<a class="me-pfp" href="${BASE}${esc(username)}" title="Profilul meu" aria-label="Profilul meu">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc((p.name || username).trim().charAt(0).toUpperCase())}</a>` : '<a class="btn small ghost" href="settings">Setări</a>'}`;
  }

  async function renderAuthSlot() {
    // ce nu are sens fara cont se ascunde (vezi body.logged-out in style.css)
    document.body.classList.toggle('logged-out', !(backend && backend.user));
    swapNav(Boolean(backend && backend.user));
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    if (!backend || !backend.user) {
      const fj = document.getElementById('footer-join');
      if (fj) fj.hidden = false;
      try { localStorage.removeItem('editsel_me'); } catch { /* fara localStorage */ }
      slot.innerHTML = '<a class="btn small ghost" href="login">Intră</a><a class="btn small primary" href="signup">Creează cont</a>';
      return;
    }
    let username = '';
    let myP = null;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('editsel_me') || 'null'); } catch { /* fara localStorage */ }
    if (cached && cached.uid === backend.user.uid) slot.innerHTML = authSlotHtml(cached);
    try { myP = await backend.myProfile(); username = myP.username || ''; } catch { /* profil inexistent */ }
    try { localStorage.setItem('editsel_me', JSON.stringify(myP ? { uid: backend.user.uid, username, name: myP.name || '', avatar: myP.avatar || '' } : null)); } catch { /* fara localStorage */ }
    const fj = document.getElementById('footer-join');
    if (fj) fj.hidden = true;
    const fp = document.getElementById('footer-profile');
    if (fp && username) fp.href = BASE + username;
    const fd = document.getElementById('footer-diary');
    if (fd && username) fd.href = BASE + username + '/diary';
    const fa = document.getElementById('footer-add');
    if (fa && !fa.dataset.hooked) {
      fa.dataset.hooked = '1';
      fa.addEventListener('click', (e) => {
        const t = document.querySelector('#hsearch .hs-toggle');
        if (!t || !t.offsetParent) return; // pe telefon merge la Descopera
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        t.click();
      });
    }
    const bn = document.getElementById('bn-profile');
    if (bn && username) { bn.href = BASE + username; bn.innerHTML = `<span>${icon('user')}</span>Profil`; }
    slot.innerHTML = authSlotHtml(myP ? { username, name: myP.name, avatar: myP.avatar } : {});
    setupBell();
    updateRequestBadge();
  }

  // ---------- pagina principala ----------

  const FEATURES = [
    [WL.ic('book'), 'Jurnal', 'Notează fiecare episod și film văzut, cu dată, notă și apreciere. Totul ordonat pe luni.'],
    [WL.ic('star'), 'Note și recenzii', 'Stele cu jumătăți, recenzii cu spoilere ascunse și note pe fiecare sezon.'],
    [WL.ic('list'), 'Liste', 'Topuri, colecții, „de văzut în weekend” — liste numerotate sau simple.'],
    [WL.ic('users'), 'Prieteni', 'Adaugă-ți prietenii și vezi ce au văzut și cât de mult le-a plăcut.'],
  ];

  function pageHome() {
    const logged = backend.user;
    const cta = logged
      ? `<a class="btn primary" href="settings">${WL.ic('plus')}Adaugă seriale</a><a class="btn" id="home-my" href="./">Profilul meu</a>`
      : '<a class="btn primary" href="signup">Creează cont gratuit</a><a class="btn" href="login">Am deja cont</a>';
    return `<section class="home-hero">
        <div class="mosaic" id="poster-wall" aria-hidden="true">
          ${Array.from({ length: 48 }, (_, i) => `<div class="pw-card" style="--i:${i}"></div>`).join('')}
        </div>
        <div class="mosaic-shade"></div>
        <div class="container hero-copy">
          <span class="home-kicker">Jurnal de seriale și filme</span>
          <h1>Toate filmele și serialele tale.<br><span>Într-un singur loc.</span></h1>
          <p>Notează ce vezi, dă note, scrie recenzii, fă-ți liste și vezi ce urmăresc prietenii tăi. Gratuit, fără reclame.</p>
          <div class="home-cta">${cta}</div>
        </div>
      </section>

      <div class="container page home-page">
        <section class="section" id="trend-tv-wrap">
          <div class="section-head"><h2>Seriale populare acum</h2></div>
          <div class="row-scroll trend-row" id="trend-tv">${Array.from({ length: 8 }, () => '<div class="poster"><div class="poster-img skeleton"></div></div>').join('')}</div>
        </section>
        <section class="section" id="trend-movie-wrap">
          <div class="section-head"><h2>Filme populare acum</h2></div>
          <div class="row-scroll trend-row" id="trend-movie">${Array.from({ length: 8 }, () => '<div class="poster"><div class="poster-img skeleton"></div></div>').join('')}</div>
        </section>

        <section class="home-features">
          ${FEATURES.map(([ic, t, d]) => `<div class="feature"><span class="feature-ic">${ic}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
        </section>

        ${logged ? '' : `<section class="home-final">
          <h2>Începe-ți jurnalul azi.</h2>
          <p>Gratuit, fără reclame. Durează un minut.</p>
          <a class="btn primary" href="signup">Creează cont</a>
        </section>`}
      </div>`;
  }

  async function fillHome() {
    if (backend.user) backend.myUsername().then((u) => { const a = document.getElementById('home-my'); if (a && u) a.href = BASE + u; }).catch(() => {});
    let trending = { tv: [], movie: [] };
    const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    await Promise.all([
      backend.loadHome().then((h) => { trending = h; }).catch((e) => console.error(e)),
    ]);
    if (!document.getElementById('poster-wall')) return;

    // randurile cu seriale si filme populare, in ordine aleatorie la fiecare vizita
    for (const type of ['tv', 'movie']) {
      const row = document.getElementById('trend-' + type);
      const list = shuffle(trending[type] || []).slice(0, 18);
      if (!row) continue;
      if (!list.length) { document.getElementById(`trend-${type}-wrap`).remove(); continue; }
      row.innerHTML = list.map((t) => `<a class="poster trend-card" href="https://www.themoviedb.org/${t.type}/${t.id}" target="_blank" rel="noopener" title="${esc(t.title)}">
          <div class="poster-img"><img src="${esc(t.poster)}" alt="${esc(t.title)}" loading="lazy">${t.rating ? `<span class="tmdb-score">${WL.ic('star')} ${t.rating.toFixed(1)}</span>` : ''}</div>
          <div class="trend-title">${esc(t.title)}</div><div class="trend-year">${esc(t.year || '')}</div>
        </a>`).join('');
    }
    const allTrending = [...(trending.tv || []), ...(trending.movie || [])];
    // peretele de postere: seriale si filme populare
    const posters = shuffle([...new Set(allTrending.map((t) => t.poster).filter((p) => p && /^https?:/.test(p)))]).slice(0, 48);
    const wall = document.getElementById('poster-wall');
    if (wall && posters.length) {
      wall.innerHTML = Array.from({ length: 48 }, (_, i) => {
        const src = posters[i % posters.length];
        return `<div class="pw-card" style="--i:${i}"><img src="${esc(src)}" alt="" loading="lazy"></div>`;
      }).join('');
    }

  }


  // ---------- cautare in antet: seriale, filme si membri ----------

  function setupSearch() {
    const wrap = document.getElementById('hsearch');
    if (!wrap) return;
    const input = wrap.querySelector('input');
    const box = document.getElementById('hs-results');
    const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let members = null;
    let popular = null;
    let mine = null;
    let timer = 0;
    let seq = 0;

    const open = () => { wrap.classList.add('open'); input.focus(); };
    const close = () => { wrap.classList.remove('open'); box.classList.add('hidden'); };
    wrap.querySelector('.hs-toggle').addEventListener('click', () => (wrap.classList.contains('open') && !input.value ? close() : open()));
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
      if (e.key === 'Escape' && wrap.classList.contains('open')) { input.value = ''; close(); input.blur(); }
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) { box.classList.add('hidden'); if (!input.value) wrap.classList.remove('open'); }
    });
    box.addEventListener('click', (e) => { if (e.target.closest('a')) { input.value = ''; close(); } });
    input.addEventListener('focus', () => { if (input.value.trim()) box.classList.remove('hidden'); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        const q = input.value.trim();
        input.value = '';
        close();
        input.blur();
        navigate(`${BASE}search?q=${encodeURIComponent(q)}`);
      }
    });
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(run, 280);
    });

    const titleLink = (t) => (backend.user
      ? showHref(t.type, t.tmdbId, t.title)
      : `https://www.themoviedb.org/${t.type}/${t.tmdbId}`);

    async function run() {
      const q = input.value.trim();
      const my = ++seq;
      if (!q) { box.classList.add('hidden'); return; }
      box.classList.remove('hidden');
      box.innerHTML = '<div class="hs-empty">Caut…</div>';
      const nq = norm(q);

      if (!members) members = await backend.listMembers().catch(() => []);
      const people = members.filter((p) => p.username && (norm(p.username).includes(nq) || norm(p.name).includes(nq))).slice(0, 5);

      let titles = [];
      if (backend.user) {
        const [res, me] = await Promise.all([
          api(`/api/tmdb/search?type=multi&q=${encodeURIComponent(q)}`).catch(() => []),
          mine || api('/api/public').catch(() => null),
        ]);
        mine = me;
        titles = res.slice(0, 8);
      } else {
        if (!popular) {
          const h = await backend.loadHome().catch(() => ({ tv: [], movie: [] }));
          popular = [...(h.tv || []), ...(h.movie || [])].map((t) => ({ ...t, tmdbId: t.id }));
        }
        titles = popular.filter((t) => norm(t.title).includes(nq)).slice(0, 8);
      }
      if (my !== seq) return;

      const owned = (t) => mine && mine.titles.some((x) => x.tmdbId === t.tmdbId && x.type === t.type);
      const peopleHtml = people.map((p) => `<a href="${BASE}${esc(p.username)}">
          ${p.avatar ? `<img class="hs-avatar" src="${esc(p.avatar)}" alt="">` : `<span class="hs-avatar" style="color:${esc(p.accent || 'var(--accent)')}">${esc((p.name || p.username).charAt(0).toUpperCase())}</span>`}
          <span class="hs-text"><b>${esc(p.name || p.username)}</b><small>@${esc(p.username)}</small></span></a>`).join('');
      const titlesHtml = titles.map((t) => `<a href="${esc(titleLink(t))}" ${backend.user ? `data-add="${t.type}:${t.tmdbId}"` : 'target="_blank" rel="noopener"'}>
          ${t.poster ? `<img class="hs-poster" src="${esc(t.poster)}" alt="" loading="lazy">` : '<span class="hs-poster"></span>'}
          <span class="hs-text"><b>${esc(t.title)}</b><small>${esc(t.year || '—')} · ${t.type === 'tv' ? 'Serial' : 'Film'}${owned(t) ? ' · <em>în biblioteca ta</em>' : ''}</small></span>
          ${backend.user ? `<span class="hs-action">${owned(t) ? 'Editează' : WL.ic('plus') + ' Adaugă'}</span>` : ''}</a>`).join('');

      box.innerHTML = (peopleHtml ? `<div class="hs-group">Membri</div>${peopleHtml}` : '')
        + (titlesHtml ? `<div class="hs-group">Seriale și filme</div>${titlesHtml}` : '')
        + `<a class="hs-all" href="${BASE}search?q=${encodeURIComponent(q)}">Vezi toate rezultatele pentru „${esc(q)}” <kbd>Enter</kbd></a>`
        + (!backend.user ? '<div class="hs-hint"><a href="signup">Fă-ți cont</a> ca să cauți orice serial sau film și să-l adaugi în jurnal.</div>' : '');
      if (!peopleHtml && !titlesHtml) box.insertAdjacentHTML('afterbegin', '<div class="hs-empty">Nu am găsit nimic.</div>');
    }
  }

  // ---------- Descopera (prima pagina dupa logare, ca la Serializd) ----------

  const DISCOVER = [
    ['popular-shows', 'Seriale populare', 'popularTv'],
    ['trending-shows', 'Seriale în trend', 'tv'],
    ['popular-movies', 'Filme populare', 'popularMovie'],
    ['trending-movies', 'Filme în trend', 'movie'],
    ['top-shows', 'Cele mai apreciate seriale', 'topTv'],
    ['top-movies', 'Cele mai apreciate filme', 'topMovie'],
  ];
  let homeData = null;
  const loadHomeData = () => (homeData || (homeData = backend.loadHome().catch(() => ({}))));

  function discoverCard(t, owned) {
    const href = backend.user ? showHref(t.type, t.id, t.title) : `https://www.themoviedb.org/${t.type}/${t.id}`;
    return `<a class="poster disc-card" href="${esc(href)}" ${backend.user ? `data-add="${t.type}:${t.id}"` : 'target="_blank" rel="noopener"'} title="${esc(t.title)}${t.year ? ' (' + esc(t.year) + ')' : ''}">
      <div class="poster-img"><img src="${esc(t.poster)}" alt="${esc(t.title)}" loading="lazy">
        <div class="disc-over"><b>${esc(t.title)}</b><span>${esc(t.year || '')}${t.rating ? ' · ' + WL.ic('star') + ' ' + t.rating.toFixed(1) : ''}</span>
          ${backend.user ? `<em>${owned ? WL.ic('check') + ' În biblioteca ta' : WL.ic('plus') + ' Adaugă'}</em>` : ''}</div>
      </div></a>`;
  }

  // serialul zilei: acelasi pentru toti vizitatorii, in fiecare zi urmatorul din lista (25 oct 2026 = primul)
  const BANNER_SHOWS = [
    [1396, 'Breaking Bad', 'tsRy63Mu5cu8etL1X7ZLyf7UP1M sp1RSDvoVsbvDouQx1A75ebU35e 84XPpjGvxNyExjSuLQe0SzioErt wSztOsbdspDi0E6dWU1cxNmYDV9 n3u3kgNttY1F5Ixi5bMY9BwZImQ 63FA8vwSZnXkGxedrDQwni4JuZN'],
    [1399, 'Game of Thrones', 'zZqpAXxVSBtxV9qPBcscfXBcL2w wXSnajAZ5ppTKa8Z5zzWGOK85YH 4kTINu9mv2YV1PqFqPGG1FZMnhi jJojoFmsuLPQz8AOdkeV0b686RN suopoADq0k8YZr4dQXcU6pToj6s rIe3PnM6S7IBUmvNwDkBMX0i9EZ'],
    [60574, 'Peaky Blinders', 'dzq83RHwQcnP6WGJ6YkenIqeaa5 wiE9doxiLwq3WCGamDIOb2PqBqc l8v3gJDlASN0lNn51gR8zQJsu5O kfUWupX3phYp7AleZA2U1dmVcjX 8V1XPEDLtJoxOWlE6gYzn2sQaMp or7wKwv1IT6LEOktt395O5qi7e'],
    [1398, 'The Sopranos', 'lNpkvX2s8LGB0mjGODMT4o6Up7j 4QxoeC76pGZYlNmMXCRWb2GtWyd isJ4POBlbH5kmHVgbdP4gC4nFqO kGPuCU0ZytTans1eakw0xdLtAGo nseRssdVVNQJZh2kBPnHUU5fkgj mRsSY7CIE8mx8zanNIENFVUPmiO'],
    [66732, 'Stranger Things', '9P4IIMYY3HifqeruZq0ZZ9g7YUi 8zbAoryWbtH0DKdev8abFAjdufy 56v2KjBlU4XaOv9rVYEQypROD7P kiFJZHRyTV207BhLRtUu3sAsJKh 2MaumbgBlW1NoPo3ZJO38A6v7OS ekLmP9wccC47PC83eJuklEy0twf'],
    [5920, 'The Mentalist', 'rJFqKcmMSttdNP58l0dVzY2NcTA q3pCsNvJ7CmdJUz2sJEEUY3pOPC eUg803qy6luwe8Rys1PkDTw629C ov0WjAg0CclTDLBPy36nBiJ1fN5 jh9YpYaG1be7FOtBUxkLTIkhQHI 1mOt9QtVJAAeFD4mF33Bpr2Msv7'],
    [60059, 'Better Call Saul', 'rfxryDIv8huejujg4JueDJx8zCz og2jKploGHYnCz68vV1nRSEE0xV t15KHp3iNfHVQBNIaqUGW12xQA4 u5pPTiLMEvxaPtdhF2Wj6YTXI2h hPea3Qy5Gd6z4kJLUruBbwAH8Rm nT91taow0c4Rcgu8FoEIvttBmeO'],
    [46648, 'True Detective', 'v8YFr8BbU9qsO8PYIulzTeM6Qk bPLRjO2pcBx0WL73WUPzuNzQ3YN qezjDPeSfjJWhCFnqJPBrl08srT 2lc2sMBIK5emiMMcXBPBV23nRR6 scx72FpTF929jYXea0MphyE24Wa siA2d4PNn4JVFZAwfIYx4pnKCaK'],
    [1408, 'House', 'r0Q6eeN9L1ORL9QsV0Sg8ZV3vnv 4EsemR6NIqsBspVxZppsAgeuaUg r9t9lblyPfudl0LV0Ujg1nXdKyW Ah8BIRHTvx4Rk6HgJHsIYgQT6PW rr6tcoprk8aDtEyrBRmEX2buk9T fALA09CjZREXJf80yyZR9A0nTqc'],
    [100088, 'The Last of Us', 'lY2DhbA7Hy44fAKddr06UrXWWaQ uDgy6hyPd82kOHh6I95FLtLnj6p 2RSbYPDkNd3hkGp4VWpTFalU9z7 acevLdSl5I2MK5RYAm7gwAndt1w 7dowXHcFccjmxf0YZYxDFkfVq65 uQ4lG7E7mlyKsGvbASftQ6Hu2IX'],
    [2288, 'Prison Break', 'n3Brk7roueE9HOwVmYlJx5j462g e9veIcSy0MUJpQqlffQJdKId9eF 2dEjX0XUq5PWEo9PH7HGtk0NzPj 7w165QdHmJuTHSQwEyJDBDpuDT7 snzSt7bn2y7I1hMYATMMDBxGns7 92OPBZpLc82y8CzOtrQ8P9RDvIN'],
    [62560, 'Mr. Robot', 'uJUe985oIuRiD3hmHQYskIMc2WU hZOuVkhAWX9viLJuaIsMh8cM3Jz 4ceSkV7cmCon4exXaZwuhW1VdE0 iIKDEYVsA2B5nRjFw347dSlYpq0 2vDcqE0jrfmRnsSRf8X08ibr8x9 1SEVAgbaah9wE5xoLt4qWPMBdpL'],
    [63351, 'Narcos', 'y9ekzkPFmWSqUU3Kj0wHmYUM8qu qx8XQund44cecIJiX2Yb4SUeiT 4C3wrZbM0KtRIBCp1eufD8xKAS2 2lZRgly6NrjN96nR0p6HUbxSs1u 4ryh7FgVSSaCRLS00ppWJihxto uFBiDlNYPW7SVeGwqC0KPcf8H0C'],
    [76479, 'The Boys', 'bq28ajZaoMyzEIm6REelqyqtEDZ n6vVs6z8obNbExdD3QHTr4Utu1Z czffzEgaBko4mXW84B1J1EnQBzo 7cqKGQMnNabzOpi7qaIgZvQ7NGV bI37vIHSH7o4IVkq37P8cfxQGMx mGVrXeIjyecj6TKmwPVpHlscEmw'],
    [76331, 'Succession', 'd87JXX3DLkRJMfm5StCmmnmhHuX bcdUYUFk8GdpZJPiSAas9UeocLH zZ3Cv1lz61V9OXXvtCPVtCFTVP7 pvxlTSiM7VsbxdSYLrnKrN1OIUZ 8BcQ49alz5CQABR0oiBKpQtQSro brC6qt6QLcWhVl1wsDp1dX9Lim'],
    [2316, 'The Office', '9vMzIrMIncPmtalcxh1MOrgcE6C bY2J2Jq8rSrKm5xCFtzYzqFh44o mLyW3UTgi2lsMdtueYODcfAB9Ku 35w8giCVT7ZXc0gAAjx8MRaWL90 klDoi212oi2ewNSvbzPOvOP0KCl b7wyaeJGU2Q4ql7xZr52vdW5TKp'],
    [95396, 'Severance', 'ixgFmf1X59PUZam2qbAfskx2gQr 9xDCTGhEWpz206PCiimRGmK67rV r9KaBE7i4ovg8uSppQrCp6ZdPD9 npD65vPa4vvn1ZHpp3o05A5vdKT 8MtMFngDWvIdRo34rz3ao0BGBAe 5OsiT39OiZNdD0v2LiAcI2TpSYj'],
    [4607, 'Lost', 'yUOFocKDW7MCC5isx4FK8A68QFp 5FdGYic4Sho6DpOJCEVhcY83mc5 2e7UapYNf4DNaem6kHAuyQcF1e0 jBhcm0Rm5Uv1UaHt0TTWuRjG5G3 qpZ7dcM5yDyBDP4JSQr9LRUIBRm o1iJ1aJJnCPPjrJsfXFwgw3yA3H'],
    [1400, 'Seinfeld', 'tMRdEsMg9MyXAkcufK9YJEeIaNW jqgO8AqwgQelXhmJn6cebWjjMcY mlAzs3tyl5253roHi6eIRbeuONN lyTCCuymqg8egIaQXZAY5vE4MB0 m23XIVqQoT9CKuaN5WiCvRai9gD 2qna37NBAeUClwaqHTplNLWcqhl'],
    [1405, 'Dexter', 'aSGSxGMTP893DPMCvMl9AdnEICE iprMfJ9VHS4wMhBXyHtN7l9d2hP a7fRjgWc37Ml6bSlWoNaG7wbaqP l4pb3wCBGKYc1RaDOyXmJ1oWH9t 90j5n0K8vxf5l3ACrKaWYBgQpst sGh3WTqPaGJB3T9YNFJDNkELio5'],
  ].map(([id, title, paths]) => ({ id, type: 'tv', title, backdrops: paths.split(' ').map((p) => 'https://image.tmdb.org/t/p/w1280/' + p + '.jpg') }));
  // ziua dupa ora locala a vizitatorului (se schimba la miezul noptii)
  function bannerShow() {
    const now = new Date();
    const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 9, 25)) / 864e5);
    const n = BANNER_SHOWS.length;
    return BANNER_SHOWS[((day % n) + n) % n];
  }
  let heroTimer = null;
  function bannerTitle(t) {
    const href = backend.user ? showHref(t.type, t.id, t.title) : `https://www.themoviedb.org/${t.type}/${t.id}`;
    return `<a href="${esc(href)}" ${backend.user ? `data-add="${t.type}:${t.id}"` : 'target="_blank" rel="noopener"'}>${esc(t.title)}</a>`;
  }

  // fundalurile serialului zilei, cu tranzitie la fiecare 6 secunde
  function fillBanner() {
    const heroBox = document.getElementById('disc-hero');
    clearInterval(heroTimer);
    if (!heroBox) return;
    const slides = bannerShow().backdrops;
    heroBox.innerHTML = slides.map((src, i) => `<div class="disc-slide${i ? '' : ' on'}" style="background-image:url('${esc(src)}')"></div>`).join('');
    let cur = 0;
    if (slides.length > 1) heroTimer = setInterval(() => {
      if (!heroBox.isConnected) { clearInterval(heroTimer); return; }
      const els = heroBox.children;
      els[cur].classList.remove('on');
      cur = (cur + 1) % slides.length;
      els[cur].classList.add('on');
    }, 6000);
  }

  function pageDiscover(listKey) {
    const one = DISCOVER.find((d) => d[0] === listKey);
    const show = bannerShow();
    const head = one
      ? `<a class="see-all" href="${BASE}discover">‹ Descoperă</a><h1 class="disc-title">${one[1]}</h1>`
      : `<h1 class="disc-title disc-banner-title" id="disc-hero-name">${bannerTitle(show)}</h1>`;
    const rows = (one ? [one] : DISCOVER).map(([key, label]) => `<section class="section disc-section" data-key="${key}">
        ${one ? '' : `<div class="section-head"><h2>${label}</h2><a class="see-all" href="${BASE}discover/${key}">Vezi tot ›</a></div>`}
        <div class="${one ? 'grid lg' : 'disc-row'}" id="disc-${key}">${Array.from({ length: one ? 20 : 8 }, () => '<div class="poster"><div class="poster-img skeleton"></div></div>').join('')}</div>
      </section>`).join('');
    const hero = one ? '' : `<div class="hero disc-hero" id="disc-hero" aria-hidden="true"><div class="disc-slide on" style="background-image:url('${esc(show.backdrops[0])}')"></div></div>`;
    return `${hero}<div class="container page disc-page${one ? '' : ' has-banner'}">${head}${rows}
    </div>`;
  }

  async function fillDiscover(listKey) {
    fillBanner();
    const [home, me] = await Promise.all([
      loadHomeData(),
      backend.user ? api('/api/public').catch(() => null) : null,
    ]);
    const owned = (t) => me && me.titles.some((x) => x.tmdbId === t.id && x.type === t.type);
    for (const [key, , field] of DISCOVER) {
      const box = document.getElementById('disc-' + key);
      if (!box) continue;
      const list = (home[field] || []).slice(0, listKey ? 40 : 8);
      if (!list.length) { box.closest('section').remove(); continue; }
      box.innerHTML = list.map((t) => discoverCard(t, owned(t))).join('');
    }
    if (!document.querySelector('.disc-section')) {
      document.querySelector('.disc-page').insertAdjacentHTML('beforeend', empty('Listele se încarcă după ce administratorul site-ului intră o dată (are nevoie de cheia TMDB).'));
    }

  }

  // ---------- pagina de rezultate (/cauta?q=...) ----------

  function pageSearch(q) {
    const sk = (n) => Array.from({ length: n }, () => '<div class="poster"><div class="poster-img skeleton"></div></div>').join('');
    return `<div class="container page disc-page">
      <h1 class="disc-title">Rezultate pentru „${esc(q)}”</h1>
      <p class="muted disc-sub" id="sr-count">Caut…</p>
      <section class="section" id="sr-people-wrap" hidden><div class="section-head"><h2>Membri</h2></div><div class="member-list sr-people" id="sr-people"></div></section>
      <section class="section" id="sr-tv-wrap"><div class="section-head"><h2>Seriale</h2></div><div class="grid lg" id="sr-tv">${sk(8)}</div></section>
      <section class="section" id="sr-movie-wrap"><div class="section-head"><h2>Filme</h2></div><div class="grid lg" id="sr-movie">${sk(8)}</div></section>
    </div>`;
  }

  async function fillSearch(q) {
    const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nq = norm(q);
    const [members, me, home] = await Promise.all([
      backend.listMembers().catch(() => []),
      backend.user ? api('/api/public').catch(() => null) : null,
      backend.user ? null : loadHomeData(),
    ]);
    let tv = [];
    let movie = [];
    if (backend.user) {
      [tv, movie] = await Promise.all([
        api(`/api/tmdb/search?type=tv&q=${encodeURIComponent(q)}`).catch(() => []),
        api(`/api/tmdb/search?type=movie&q=${encodeURIComponent(q)}`).catch(() => []),
      ]);
    } else {
      // fara cont: doar din listele populare salvate pe site
      const pool = new Map();
      for (const key of ['tv', 'movie', 'popularTv', 'popularMovie', 'topTv', 'topMovie']) {
        for (const t of (home && home[key]) || []) if (norm(t.title).includes(nq)) pool.set(t.type + t.id, { ...t, tmdbId: t.id });
      }
      tv = [...pool.values()].filter((t) => t.type === 'tv');
      movie = [...pool.values()].filter((t) => t.type === 'movie');
    }
    if (!document.getElementById('sr-tv')) return;

    const people = members.filter((p) => p.username && (norm(p.username).includes(nq) || norm(p.name).includes(nq)));
    const owned = (t) => me && me.titles.some((x) => x.tmdbId === t.tmdbId && x.type === t.type);
    const card = (t) => discoverCard({ ...t, id: t.tmdbId, rating: t.rating || 0 }, owned(t)).replace('<img src=""', '<img src="data:,"');

    const fill = (id, list) => {
      const wrap = document.getElementById(id + '-wrap');
      if (!list.length) { wrap.hidden = true; return; }
      wrap.hidden = false;
      document.getElementById(id).innerHTML = list.map((t) => (t.poster
        ? card(t)
        : `<a class="poster disc-card" href="${esc(backend.user ? showHref(t.type, t.tmdbId, t.title) : '#')}"><div class="poster-img"><div class="poster-fallback"><span>${esc(t.title)}</span></div></div></a>`)).join('');
    };
    fill('sr-tv', tv);
    fill('sr-movie', movie);

    const pw = document.getElementById('sr-people-wrap');
    if (people.length) {
      pw.hidden = false;
      document.getElementById('sr-people').innerHTML = people.slice(0, 12).map((p) => `
        <a class="member-card" href="${BASE}${esc(p.username)}" style="--friend:${esc(p.accent || 'var(--accent)')}">
          <div class="member-banner" style="${p.banner && /^https?:|^data:/.test(p.banner) ? `background-image:url('${esc(p.banner)}')` : ''}"></div>
          <div class="member-body">
            ${p.avatar ? `<img class="avatar" src="${esc(p.avatar)}" alt="" loading="lazy">` : `<div class="avatar">${esc((p.name || p.username).charAt(0).toUpperCase())}</div>`}
            <div style="min-width:0"><b>${esc(p.name || p.username)}</b><span class="muted">@${esc(p.username)}</span></div>
          </div></a>`).join('');
    }

    const total = tv.length + movie.length + people.length;
    const count = document.getElementById('sr-count');
    count.innerHTML = total
      ? `${tv.length} seriale · ${movie.length} filme${people.length ? ` · ${people.length} membri` : ''}${backend.user ? '. Click pe un poster ca să-l adaugi în jurnal.' : ''}`
      : 'Nu am găsit nimic.';
    if (!backend.user) count.insertAdjacentHTML('beforeend', ' <a href="signup" style="color:var(--accent-text)">Fă-ți cont</a> ca să cauți în toate serialele și filmele.');
  }

  // ---------- pagina Prieteni (/prieteni): cereri, prieteni, sugestii ----------

  function pageFriendsHub() {
    if (!backend.user) {
      return `<div class="container page disc-page">
        <h1 class="disc-title">Prieteni</h1>
        ${empty('<a href="signup" style="color:var(--accent-text)">Fă-ți cont</a> sau <a href="login" style="color:var(--accent-text)">intră în cont</a> ca să-ți adaugi prietenii și să vezi ce au văzut.')}
      </div>`;
    }
    return `<div class="container page disc-page">
      <h1 class="disc-title">Prieteni</h1>
      <p class="muted disc-sub">Trimite cereri de prietenie. Când celălalt acceptă, vă vedeți unul altuia activitatea.</p>
      <div class="fh-search"><span>${icon('search')}</span><input id="fh-q" type="search" placeholder="Caută după nume sau username…" autocomplete="off"></div>
      <div id="fh-body"><div class="member-list">${Array.from({ length: 3 }, () => '<div class="card friend-card skeleton"></div>').join('')}</div></div>
    </div>`;
  }

  async function fillFriendsHub() {
    const body = document.getElementById('fh-body');
    if (!body) return;
    const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let [members, me] = await Promise.all([backend.listMembers().catch(() => []), api('/api/public').catch(() => null)]);
    if (!me || !body.isConnected) return;
    members = members.filter((p) => p.username && p.uid !== backend.user.uid);

    const ACTIONS = {
      received: `<button class="btn small primary" data-act="add">${WL.ic('check')}Acceptă</button><button class="btn small ghost" data-act="decline">Refuză</button>`,
      friends: `<button class="btn small" data-act="cancel" data-confirm="1">${WL.ic('check')}Prieteni</button>`,
      sent: '<button class="btn small" data-act="cancel">Anulează cererea</button>',
      none: '<button class="btn small primary" data-act="add">+ Adaugă prieten</button>',
    };
    const row = (p, rel) => `<div class="fh-row" data-uid="${esc(p.uid)}" style="--friend:${esc(p.accent || 'var(--accent)')}">
        <a class="fh-person" href="${BASE}${esc(p.username)}">
          ${p.avatar ? `<img class="avatar sm" src="${esc(p.avatar)}" alt="" loading="lazy">` : `<div class="avatar sm" style="color:${esc(p.accent || 'var(--accent)')}">${esc((p.name || p.username).charAt(0).toUpperCase())}</div>`}
          <span class="hs-text"><b>${esc(p.name || p.username)}</b><small>@${esc(p.username)}${p.bio ? ' · ' + esc(p.bio.slice(0, 60)) : ''}</small></span>
        </a>
        <div class="follow-btns">${ACTIONS[rel]}</div>
      </div>`;

    const draw = () => {
      const q = norm(document.getElementById('fh-q').value.trim());
      const match = (p) => !q || norm(p.username).includes(q) || norm(p.name).includes(q);
      const groups = { received: [], friends: [], sent: [], none: [] };
      members.filter(match).forEach((p) => groups[relation(me, p)].push(p));
      const block = (title, key, emptyMsg) => {
        const list = groups[key];
        if (!list.length && !emptyMsg) return '';
        return `<section class="section"><div class="section-head"><h2>${title}${list.length ? ` · ${list.length}` : ''}</h2></div>
          ${list.length ? `<div class="fh-list">${list.map((p) => row(p, key)).join('')}</div>` : empty(emptyMsg)}</section>`;
      };
      body.innerHTML = block('Cereri de prietenie', 'received')
        + block('Prietenii tăi', 'friends', q ? '' : 'Nu ai prieteni încă. Trimite o cerere cuiva de mai jos.')
        + block('Cereri trimise', 'sent')
        + block(q ? 'Rezultate' : 'Sugestii', 'none', q ? 'Niciun membru găsit.' : 'Nu mai sunt alți membri. Trimite-le prietenilor link-ul site-ului!');
    };
    draw();
    document.getElementById('fh-q').addEventListener('input', draw);
    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const uid = btn.closest('[data-uid]').dataset.uid;
      const p = members.find((x) => x.uid === uid);
      if (btn.dataset.confirm && !confirm(`Îl scoți pe ${p ? p.name || p.username : 'acest membru'} de la prieteni?`)) return;
      btn.disabled = true;
      try { await setRelation(me, uid, btn.dataset.act); } catch (err) { alert(err.message); }
      draw();
    });
  }

  // ---------- Calendar (/calendar): episoadele noi din serialele tale ----------

  const WEEKDAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const localDay = (offset = 0) => {
    const n = new Date();
    n.setDate(n.getDate() + offset);
    return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const dayLabel = (s) => { const d = parseDate(s); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`; };

  function pageCalendar() {
    if (!backend.user) {
      return `<div class="container page disc-page">
        <h1 class="disc-title">Calendar</h1>
        ${empty('<a href="signup" style="color:var(--accent-text)">Fă-ți cont</a> sau <a href="login" style="color:var(--accent-text)">intră în cont</a> ca să vezi când apar episoadele noi din serialele tale.')}
      </div>`;
    }
    return `<div class="container page disc-page cal-page">
      <div class="cal-top">
        <div><h1 class="disc-title">Calendar</h1><p class="muted disc-sub">Episoadele noi din serialele tale, zi cu zi.</p></div>
        <button type="button" class="btn small ghost" id="cal-refresh">${WL.ic('refresh')}Reîmprospătează</button>
      </div>
      <div id="cal-body">${Array.from({ length: 4 }, () => '<div class="cal-row skeleton"></div>').join('')}</div>
    </div>`;
  }

  async function fillCalendar(force = false) {
    const body = document.getElementById('cal-body');
    if (!body) return;
    let list;
    try { list = await api('/api/upcoming' + (force ? '?force=1' : '')); } catch (e) {
      if (body.isConnected) body.innerHTML = empty(esc(e.message));
      return;
    }
    if (!body.isConnected) return;
    const today = localDay();
    const tomorrow = localDay(1);
    const weekEnd = localDay(7);
    const row = (e, withDate = false) => `<a class="cal-row" href="${esc(showHref('tv', e.tmdbId, e.title))}">
        <div class="cal-still">${e.still || e.poster ? `<img src="${esc(e.still || e.poster)}" alt="" loading="lazy" class="${e.still ? '' : 'is-poster'}">` : ''}</div>
        <div class="cal-info">
          <b class="notranslate">${esc(e.title)}</b>
          <span>S${e.season} · E${e.episode}${e.name && !/^(episodul|episode) \d+$/i.test(e.name) ? ` · <span class="notranslate">${esc(e.name)}</span>` : ''}</span>
          <small class="muted">${withDate ? esc(dayLabel(e.airDate)) + (e.network ? ' · ' : '') : ''}${esc(e.network)}${e.runtime ? ` · ${e.runtime} min` : ''}</small>
        </div>
        <div class="cal-tags">${e.premiere ? `<span class="badge accent">${e.episode === 1 && e.season === 1 ? 'Serial nou' : 'Sezon nou'}</span>` : ''}${e.finale ? '<span class="badge">Final de sezon</span>' : ''}</div>
      </a>`;
    const later = list.filter((e) => e.later);
    const recent = list.filter((e) => !e.later && e.airDate < today).reverse();
    const next = list.filter((e) => !e.later && e.airDate >= today);
    const days = new Map();
    for (const e of next) { if (!days.has(e.airDate)) days.set(e.airDate, []); days.get(e.airDate).push(e); }
    const thisWeek = next.filter((e) => e.airDate < weekEnd).length;
    const group = (title, items, withDate, cls = '') => `<section class="cal-day ${cls}"><h2 class="cal-day-head">${title}<span>${plural(items.length, 'episod', 'episoade')}</span></h2>
        <div class="cal-list">${items.map((e) => row(e, withDate)).join('')}</div></section>`;
    const dayTitle = (d) => (d === today ? 'Azi' : d === tomorrow ? 'Mâine' : esc(dayLabel(d)));
    body.innerHTML = !list.length
      ? empty('Niciun episod nou în următoarele două luni. Marchează serialele pe care le urmărești cu „Mă uit acum” sau „De văzut” și apar aici.')
      : `<div class="cal-summary">
          <div class="card"><b>${days.has(today) ? days.get(today).length : 0}</b><span>azi</span></div>
          <div class="card"><b>${thisWeek}</b><span>în următoarele 7 zile</span></div>
          <div class="card"><b>${recent.length}</b><span>apărute săptămâna trecută</span></div>
        </div>
        ${[...days].map(([d, items]) => group(dayTitle(d), items, false, d === today ? 'is-today' : '')).join('') || empty('Nimic programat în următoarele două luni.')}
        ${recent.length ? group('Au apărut recent', recent, true, 'is-past') : ''}
        ${later.length ? group('Mai târziu', later, true) : ''}
        <p class="muted cal-note">Datele sunt de pe TMDB, pentru serialele din biblioteca ta (fără cele abandonate). Se actualizează la câteva ore.</p>`;
  }

  // ---------- adaugare rapida: pop-up direct pe pagina (fara sa mergi in Setari) ----------

  function toast(msg, isErr = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), isErr ? 4500 : 2400);
  }

  function openModal(html) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() { back.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; }
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    return { el: back.querySelector('.modal'), close };
  }

  // stele cu jumatati: click pe jumatatea stanga = x.5; click pe aceeasi valoare = sterge
  function starInput(container, value, onChange, small = false) {
    let v = value || 0;
    container.innerHTML = `<span class="star-input ${small ? 'sm' : ''}">${`<span class="s">${WL.ic('star')}<span class="h">${WL.ic('star')}</span></span>`.repeat(5)}<span class="val"></span></span>`;
    const wrap = container.firstElementChild;
    const els = [...wrap.querySelectorAll('.s')];
    const val = wrap.querySelector('.val');
    const paint = (x) => { els.forEach((s, i) => { s.className = 's ' + (x >= i + 1 ? 'full' : x >= i + 0.5 ? 'half' : ''); }); val.textContent = x ? x.toFixed(1) : '—'; };
    const at = (e) => {
      const s = e.target.closest('.s');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return els.indexOf(s) + ((e.clientX - r.left) < r.width / 2 ? 0.5 : 1);
    };
    wrap.addEventListener('mousemove', (e) => { const x = at(e); if (x) paint(x); });
    wrap.addEventListener('mouseleave', () => paint(v));
    wrap.addEventListener('click', (e) => { const x = at(e); if (!x) return; v = x === v ? 0 : x; paint(v); onChange(v); });
    paint(v);
  }

  async function quickAdd(type, tmdbId, sourceEl, onDone) {
    if (!backend || !backend.user) { location.href = 'signup'; return; }
    const loading = openModal('<div class="modal-body"><div class="muted">Se încarcă…</div></div>');
    let me;
    let details;
    try {
      me = await api('/api/public');
      const existing = me.titles.find((t) => t.type === type && t.tmdbId === Number(tmdbId));
      details = existing || await api(`/api/tmdb/details?type=${type}&id=${tmdbId}`);
      if (!loading.el.isConnected) return;
      loading.close();
      showQuickAdd(details, Boolean(existing), sourceEl, onDone);
    } catch (e) {
      if (!loading.el.isConnected) return;
      loading.close();
      toast(e.message, true);
    }
  }

  function showQuickAdd(t, isExisting, sourceEl, onDone) {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const d = { favorite: Boolean(t.favorite), episodesWatched: t.episodesWatched || 0, seasonRatings: { ...(t.seasonRatings || {}) }, note: t.note || '', poster: t.poster || '', backdrop: t.backdrop || '', status: t.status || 'watched', rating: t.rating || 0, liked: Boolean(t.liked), review: t.review || '', spoiler: Boolean(t.spoiler) };
    const isTv = t.type === 'tv';
    const { el, close } = openModal(`
      <div class="modal-head">
        <div style="width:70px;flex:none">${poster(t, { showMeta: false })}</div>
        <div style="min-width:0">
          <h2 class="notranslate">${esc(t.title)}</h2>
          <div class="muted" style="font-size:14px">${[t.year, isTv ? 'Serial' : 'Film', (t.genres || []).slice(0, 3).join(', ')].filter(Boolean).map(esc).join(' · ')}</div>
          ${isExisting ? '<span class="badge accent" style="margin-top:6px">În biblioteca ta</span>' : ''}
          ${t.tmdbId ? '<div style="margin-top:8px"><button type="button" class="btn small ghost" id="qa-details">Detalii ›</button></div>' : ''}
        </div>
      </div>
      <div class="modal-body">
        <div class="field"><span class="lbl">Status</span>
          <div class="seg" id="qa-status">${Object.entries(STATUS).map(([k, s]) => `<button type="button" data-v="${k}" class="${d.status === k ? 'on' : ''}">${s.icon} ${s.label}</button>`).join('')}</div>
        </div>
        <div class="row-fields">
          <div class="field"><span class="lbl">Notă</span><div id="qa-rating"></div></div>
          <div class="field"><span class="lbl">Îți place?</span><div><button type="button" class="toggle like ${d.liked ? 'on' : ''}" id="qa-like">${WL.ic('heart')} Îmi place</button></div></div>
        </div>
        <div class="field"><label for="qa-review">Recenzie (opțional)</label>
          <textarea class="textarea" id="qa-review" style="min-height:80px" placeholder="Ce părere ai?">${esc(d.review)}</textarea>
          <label class="check"><input type="checkbox" id="qa-spoiler" ${d.spoiler ? 'checked' : ''}> Conține spoilere</label>
        </div>
        <div class="box" style="margin:0">
          <label class="check"><input type="checkbox" id="qa-log" ${isExisting || d.status === 'watchlist' ? '' : 'checked'}> <b>Adaugă în jurnal</b></label>
          <div class="row-fields" id="qa-log-fields" style="margin-top:12px">
            <div class="field"><label>Data</label><input class="input" type="date" id="qa-date" value="${today}"></div>
            ${isTv ? '<div class="field"><label>Sezon</label><input class="input" type="number" min="0" id="qa-s"></div><div class="field"><label>Episod</label><input class="input" type="number" min="0" id="qa-e"></div>' : ''}
            <div class="field" style="justify-content:flex-end"><label class="check"><input type="checkbox" id="qa-rw"> Revăzut</label></div>
          </div>
        </div>
      </div>
      <div class="qa-more hidden" id="qa-more">
        <div class="row-fields">
          <div class="field"><span class="lbl">Favorit</span><div><button type="button" class="toggle fav ${d.favorite ? 'on' : ''}" id="qa-fav">${WL.ic('star')} Favorit</button></div></div>
          ${isTv ? `<div class="field"><label>Episoade văzute</label><div style="display:flex;gap:8px;align-items:center">
            <input class="input" type="number" min="0" id="qa-eps" style="width:100px" value="${d.episodesWatched}">
            <span class="muted">${t.episodesCount ? 'din ' + t.episodesCount : ''}</span>
            ${t.episodesCount ? '<button type="button" class="btn small" id="qa-eps-all">Toate</button>' : ''}</div></div>` : ''}
        </div>
        ${isTv && (t.seasons || []).length ? `<div class="field"><span class="lbl">Note pe sezoane</span><div class="box" id="qa-seasons" style="margin:0"></div></div>` : ''}
        <div class="field"><label for="qa-note">Notiță (apare pe pagina titlului)</label><textarea class="textarea" id="qa-note" style="min-height:60px">${esc(d.note)}</textarea></div>
        ${t.tmdbId ? `<div class="field"><span class="lbl">Imagini</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn small" data-pick="posters">Alege alt poster</button><button type="button" class="btn small" data-pick="backdrops">Alege alt fundal</button></div>
          <div class="qa-pick hidden" id="qa-pick"></div></div>` : ''}
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ghost" id="qa-more-btn">Mai multe opțiuni ${WL.ic('down')}</button>
        <span class="grow"></span>
        ${isExisting ? `<button class="btn danger" id="qa-remove" title="Scoate titlul din bibliotecă">${WL.ic('trash')}Șterge</button>` : ''}
        <button class="btn ghost" id="qa-cancel">Anulează</button>
        <button class="btn primary" id="qa-save">${isExisting ? 'Salvează' : 'Adaugă'}</button>
      </div>`);
    const $ = (s) => el.querySelector(s);
    starInput($('#qa-rating'), d.rating, (v) => { d.rating = v; });
    $('#qa-status').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      d.status = b.dataset.v;
      el.querySelectorAll('#qa-status button').forEach((x) => x.classList.toggle('on', x === b));
      if (!isExisting) { $('#qa-log').checked = d.status !== 'watchlist'; syncLog(); }
    });
    $('#qa-like').addEventListener('click', (e) => { d.liked = !d.liked; e.currentTarget.classList.toggle('on', d.liked); });
    const syncLog = () => $('#qa-log-fields').classList.toggle('hidden', !$('#qa-log').checked);
    $('#qa-log').addEventListener('change', syncLog);
    syncLog();
    $('#qa-more-btn').addEventListener('click', (e) => {
      const more = $('#qa-more');
      more.classList.toggle('hidden');
      e.currentTarget.innerHTML = more.classList.contains('hidden') ? `Mai multe opțiuni ${WL.ic('down')}` : `Mai puține opțiuni ${WL.ic('up')}`;
      if (!more.classList.contains('hidden')) more.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('#qa-fav').addEventListener('click', (e) => { d.favorite = !d.favorite; e.currentTarget.classList.toggle('on', d.favorite); });
    if ($('#qa-eps-all')) $('#qa-eps-all').addEventListener('click', () => { $('#qa-eps').value = t.episodesCount; });
    if ($('#qa-seasons')) {
      for (const sn of t.seasons) {
        const row = document.createElement('div');
        row.className = 'season-rate';
        row.innerHTML = `<span>${esc(sn.name || 'Sezonul ' + sn.number)} <span class="muted" style="font-size:12px">${sn.episodes} ep.</span></span><span></span>`;
        starInput(row.lastElementChild, d.seasonRatings[String(sn.number)] || 0, (v) => {
          if (v) d.seasonRatings[String(sn.number)] = v; else delete d.seasonRatings[String(sn.number)];
        }, true);
        $('#qa-seasons').appendChild(row);
      }
    }
    el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', async () => {
      const kind = b.dataset.pick;
      const box = $('#qa-pick');
      box.classList.remove('hidden');
      box.innerHTML = '<div class="muted">Se încarcă imaginile…</div>';
      try {
        const imgs = await api(`/api/tmdb/images?type=${t.type}&id=${t.tmdbId}`);
        const list = imgs[kind] || [];
        box.className = 'qa-pick ' + kind;
        box.innerHTML = list.length ? list.slice(0, 40).map((im, i) => `<button type="button" data-i="${i}"><img src="${esc(im.thumb)}" alt="" loading="lazy"></button>`).join('') : '<div class="muted">Nu există alte imagini.</div>';
        box.onclick = (ev) => {
          const pickBtn = ev.target.closest('[data-i]');
          if (!pickBtn) return;
          const url = list[Number(pickBtn.dataset.i)].url;
          if (kind === 'posters') { d.poster = url; el.querySelector('.modal-head .poster').outerHTML = poster({ ...t, poster: url }, { showMeta: false }); }
          else d.backdrop = url;
          box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === pickBtn));
          toast(kind === 'posters' ? 'Poster ales. Apasă Salvează.' : 'Fundal ales. Apasă Salvează.');
        };
      } catch (err) { box.innerHTML = `<div class="muted">${esc(err.message)}</div>`; }
    }));
    $('#qa-cancel').addEventListener('click', close);
    if ($('#qa-details')) $('#qa-details').addEventListener('click', () => {
      close();
      navigate(showHref(t.type, t.tmdbId, t.title));
    });
    // adaugat din greseala: scoate titlul din biblioteca (cu intrarile lui din jurnal)
    if ($('#qa-remove')) $('#qa-remove').addEventListener('click', async (e) => {
      if (!confirm(`Ștergi „${t.title}” din bibliotecă? Se șterg și intrările din jurnal pentru el.`)) return;
      e.currentTarget.disabled = true;
      try {
        await api(`/api/titles/${t.id}`, { method: 'DELETE' });
        close();
        toast(`„${t.title}” a fost scos din bibliotecă`);
        loadedUser = null;
        if (onDone) onDone();
        const mark = sourceEl && sourceEl.querySelector('.disc-over em, .hs-action');
        if (mark) mark.innerHTML = `${WL.ic('plus')} Adaugă`;
      } catch (err) {
        e.currentTarget.disabled = false;
        toast(err.message, true);
      }
    });
    $('#qa-save').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const body = {
        status: d.status, rating: d.rating, liked: d.liked, review: $('#qa-review').value, spoiler: $('#qa-spoiler').checked,
        favorite: d.favorite, seasonRatings: d.seasonRatings, note: $('#qa-note').value, poster: d.poster, backdrop: d.backdrop,
        ...($('#qa-eps') ? { episodesWatched: Number($('#qa-eps').value) || 0 } : {}),
      };
      try {
        const saved = isExisting
          ? await api(`/api/titles/${t.id}`, { method: 'PUT', body })
          : await api('/api/titles', { method: 'POST', body: { ...t, ...body } });
        if ($('#qa-log').checked) {
          await api('/api/diary', { method: 'POST', body: {
            titleId: saved.id, date: $('#qa-date').value || today, rating: d.rating, liked: d.liked, rewatch: $('#qa-rw').checked,
            season: isTv ? $('#qa-s').value : '', episode: isTv ? $('#qa-e').value : '',
          } });
        }
        close();
        toast(isExisting ? 'Salvat' : `„${saved.title}” a fost adăugat`);
        loadedUser = null; // profilul tau se reincarca data viitoare
        if (onDone) onDone();
        const mark = sourceEl && sourceEl.querySelector('.disc-over em, .hs-action');
        if (mark) mark.innerHTML = `${WL.ic('check')} În biblioteca ta`;
      } catch (err) {
        e.target.disabled = false;
        toast(err.message, true);
      }
    });
  }

  // ---------- pagina unui serial / film (/show/5920-the-mentalist): detalii + actiuni, ca pe Serializd ----------

  const showHref = (type, id, title = '') => `${BASE}${type === 'movie' ? 'movie' : 'show'}/${id}${slug(title) ? '-' + slug(title) : ''}`;

  async function fillShowPage(type, tmdbId, token) {
    app.innerHTML = '<div class="page-loading"></div>';
    if (!backend.user) {
      app.innerHTML = `<div class="container page" style="padding-top:140px;text-align:center">${empty('<a href="signup" style="color:var(--accent-text)">Fă-ți cont</a> ca să-ți notezi serialele și filmele.')}</div>`;
      return;
    }
    let me;
    let t;
    try {
      me = await api('/api/public');
      t = me.titles.find((x) => x.type === type && x.tmdbId === tmdbId) || null;
      if (!t) t = await api(`/api/tmdb/details?type=${type}&id=${tmdbId}`);
    } catch (e) {
      if (token !== renderToken) return;
      app.innerHTML = `<div class="container page" style="padding-top:140px;text-align:center">${empty(esc(e.message))}</div>`;
      return;
    }
    if (token !== renderToken) return;
    const state = { t, owned: Boolean(t.id) };
    document.title = `${t.title} · EDITSEL`;
    drawShowPage(state);
  }

  function drawShowPage(state) {
    const { t, owned, profilePage } = state;
    const isTv = t.type === 'tv';
    const meta = [t.year, isTv && t.seasonsCount ? plural(t.seasonsCount, 'sezon', 'sezoane') : '', t.runtime ? `${t.runtime}m` : '', (t.genres || []).join(', ')].filter(Boolean).map(esc).join(' • ');
    const total = t.episodesCount || 0;
    const eps = owned ? (t.status === 'watched' && !t.episodesWatched ? total : (t.episodesWatched || 0)) : 0;
    const row = (act, ic, label, on = false, extra = '') => `<button type="button" class="act-row${on ? ' on' : ''}" data-act="${act}">${ic}<span>${label}</span>${on ? `<span class="act-on">${WL.ic('check')}</span>` : extra}</button>`;
    const st = owned ? t.status : '';
    const actions = `<div class="card act-card">
        ${row('watching', WL.ic('play'), 'Mă uit acum', st === 'watching')}
        ${row('watched', WL.ic('eye'), st === 'watched' ? 'Văzut' : 'Marchează ca văzut', st === 'watched')}
        ${row('watchlist', WL.ic('clock'), st === 'watchlist' ? 'În lista de văzut' : 'Adaugă la de văzut', st === 'watchlist')}
        ${row('paused', WL.ic('pause'), st === 'paused' ? 'Pe pauză' : 'Pune pe pauză', st === 'paused')}
        ${row('dropped', WL.ic('trash'), st === 'dropped' ? 'Abandonat' : 'Abandonează', st === 'dropped')}
        ${row('like', WL.ic('heart'), 'Îmi place', owned && t.liked)}
        ${row('fav', WL.ic('star'), 'Favorit', owned && t.favorite)}
        ${row('log', WL.ic('pen'), 'Notă, recenzie, jurnal')}
        ${owned ? row('remove', WL.ic('x'), 'Scoate din bibliotecă') : ''}
      </div>`;
    const rating = `<div class="card"><h3>Nota ta</h3><div id="sp-rating"></div></div>`;
    const epsCard = isTv ? `<div class="card eps-card"><h3>Episoade văzute</h3>
        <div class="eps-step">
          <button type="button" class="icon-btn" data-eps="-1" aria-label="Minus un episod">${WL.ic('arrowDown')}</button>
          <input class="eps-input" id="sp-eps" type="number" min="0" ${total ? `max="${total}"` : ''} value="${eps}" inputmode="numeric">
          <button type="button" class="icon-btn" data-eps="1" aria-label="Plus un episod">${WL.ic('arrowUp')}</button>
          ${total ? `<span class="muted">din ${total}</span><button type="button" class="btn small" data-eps="all">Toate</button>` : ''}
        </div>
        ${total ? `<div class="progress"><div style="width:${Math.min(100, (eps / total) * 100)}%"></div></div>` : ''}
      </div>` : '';
    const seasons = isTv && (t.seasons || []).length
      ? section(`Sezoane (${t.seasons.filter((s) => s.number > 0).length})`, `<div class="card" style="padding:0">${t.seasons.map((s) => {
          const r = (t.seasonRatings || {})[String(s.number)];
          return `<div class="season-row">
            <div class="thumb">${s.poster ? `<img src="${esc(s.poster)}" alt="" loading="lazy">` : ''}</div>
            <div><b>${esc(s.name || 'Sezonul ' + s.number)}</b><div class="diary-sub">${s.airDate ? fmtDate(s.airDate) + ' · ' : ''}${plural(s.episodes, 'episod', 'episoade')}</div></div>
            <div>${r ? stars(r, 'accent') : ''}</div>
          </div>`;
        }).join('')}</div>`)
      : '';
    const cast = (t.cast || []).length
      ? section('Distribuție', `<div class="cast">${t.cast.map((c) => `<div><div class="face">${c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : ''}</div><b>${esc(c.name)}</b><span>${esc(c.character)}</span></div>`).join('')}</div>`)
      : '';
    const review = owned && t.review ? section('Recenzia ta', `<div class="card"><div class="${t.spoiler ? 'spoiler' : ''}"><div class="text" style="white-space:pre-line">${esc(t.review)}</div></div></div>`) : '';
    const creators = (t.creators || []).length ? `<div class="card"><h3>${isTv ? 'Creat de' : 'Regia'}</h3>${t.creators.map(esc).join(', ')}${(t.networks || []).length ? `<div class="muted" style="margin-top:8px;font-size:13px">${t.networks.map(esc).join(', ')}</div>` : ''}</div>` : '';

    app.innerHTML = profilePage ? pageTitle(t.id, actions + rating + epsCard) : `
      <div class="hero title-hero" style="${t.backdrop ? `background-image:url('${esc(t.backdrop)}')` : ''}"></div>
      <div class="container">
        <div class="title-head">
          ${poster(t, { showMeta: false })}
          <div>
            <h1 class="notranslate">${esc(t.title)}</h1>
            <div class="title-meta">${meta}${owned ? ` <span class="badge accent">${(STATUS[t.status] || STATUS.watched).icon} ${(STATUS[t.status] || STATUS.watched).label}</span>` : ''}</div>
            <div class="title-actions">${trailerBtn(t)}</div>
            ${t.tagline ? `<div class="tagline">${esc(t.tagline)}</div>` : ''}
            ${t.overview ? `<p class="overview">${esc(t.overview)}</p>` : ''}
          </div>
        </div>
        <div class="title-body page">
          <div>
            ${t.overview ? `<p class="overview mobile">${esc(t.overview)}</p>` : ''}
            ${review}${seasons}${cast}
            ${!review && !seasons && !cast ? empty('Nimic în plus de afișat.') : ''}
          </div>
          <aside class="sidebar">${actions}${rating}${epsCard}${creators}</aside>
        </div>
      </div>`;
    if (profilePage) fillComments();

    // salveaza o schimbare: adauga titlul in biblioteca daca nu e deja, altfel il actualizeaza
    const save = async (patch, msg) => {
      try {
        const saved = state.owned
          ? await api(`/api/titles/${state.t.id}`, { method: 'PUT', body: patch })
          : await api('/api/titles', { method: 'POST', body: { ...state.t, status: 'watching', ...patch } });
        if (!state.owned) toast(`„${saved.title}” a fost adăugat`); else if (msg) toast(msg);
        state.t = saved;
        state.owned = true;
        loadedUser = null;
        if (profilePage) {
          DB.titles = DB.titles.map((x) => x.id === saved.id ? saved : x);
          byId.set(saved.id, saved);
        }
        drawShowPage(state);
        if (profilePage) loadProviders(saved);
      } catch (err) { toast(err.message, true); }
    };
    const reload = () => profilePage ? render() : fillShowPage(t.type, t.tmdbId, renderToken);

    starInput(document.getElementById('sp-rating'), owned ? t.rating : 0, (v) => save({ rating: v }, 'Nota salvată'));

    app.querySelector('.act-card').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (STATUS[act]) {
        const patch = { status: act };
        if (act === 'watched' && isTv && total) patch.episodesWatched = total;
        return save(patch, 'Status: ' + STATUS[act].label);
      }
      if (act === 'like') return save({ liked: !(state.owned && state.t.liked) });
      if (act === 'fav') return save({ favorite: !(state.owned && state.t.favorite) });
      if (act === 'log') return showQuickAdd(state.t, state.owned, null, reload);
      if (act === 'remove') {
        if (!confirm(`Ștergi „${t.title}” din bibliotecă? Se șterg și intrările din jurnal pentru el.`)) return;
        try {
          await api(`/api/titles/${state.t.id}`, { method: 'DELETE' });
          toast(`„${t.title}” a fost scos din bibliotecă`);
          loadedUser = null;
          if (profilePage) navigate(R(isTv ? '/shows' : '/movies')); else reload();
        } catch (err) { toast(err.message, true); }
      }
    });

    const epsInput = document.getElementById('sp-eps');
    if (epsInput) {
      let timer;
      const setEps = (n) => {
        n = Math.max(0, total ? Math.min(total, n) : n);
        epsInput.value = n;
        const bar = app.querySelector('.eps-card .progress > div');
        if (bar && total) bar.style.width = Math.min(100, (n / total) * 100) + '%';
        clearTimeout(timer);
        timer = setTimeout(() => {
          const patch = { episodesWatched: n };
          if (total && n >= total) patch.status = 'watched';
          else if (n > 0 && (!state.owned || ['watchlist', 'watched'].includes(state.t.status))) patch.status = 'watching';
          save(patch, `${n} episoade văzute`);
        }, 700);
      };
      app.querySelector('.eps-card').addEventListener('click', (e) => {
        const b = e.target.closest('[data-eps]');
        if (!b) return;
        setEps(b.dataset.eps === 'all' ? total : (Number(epsInput.value) || 0) + Number(b.dataset.eps));
      });
      epsInput.addEventListener('change', () => setEps(Number(epsInput.value) || 0));
    }
  }

  // trailerul se vede intr-o fereastra peste pagina (YouTube fara cookie-uri); se opreste cand o inchizi
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-trailer]');
    if (!b) return;
    const [type, id] = b.dataset.trailer.split(':');
    b.disabled = true;
    let v = null;
    try { v = await api(`/api/tmdb/trailer?type=${type}&id=${id}`); } catch { /* fara trailer */ }
    b.disabled = false;
    const m = openModal(v
      ? `<div class="trailer-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.key)}?autoplay=1&rel=0" title="${esc(v.name || 'Trailer')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
        <div class="trailer-foot"><span class="muted notranslate">${esc(v.name)}</span><button type="button" class="btn small ghost" data-close>${WL.ic('x')}Închide</button></div>`
      : `<div class="modal-body"><p style="margin-top:0">Nu am găsit un trailer pe TMDB pentru titlul ăsta.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-close>Închide</button><a class="btn primary" href="${esc(b.dataset.search)}" target="_blank" rel="noopener">${WL.ic('external')}Caută pe YouTube</a></div></div>`);
    m.el.classList.add(v ? 'modal-video' : 'modal-small');
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.closest('a[target]')) m.close(); });
  });

  // Descopera si cautarea deschid direct pagina titlului, cu actiunile lui
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[data-add]');
    if (!a || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const [type, id] = a.dataset.add.split(':');
    const box = document.getElementById('hs-results');
    if (box) box.classList.add('hidden');
    const ms = document.getElementById('msearch');
    if (ms) { ms.remove(); document.body.style.overflow = ''; }
    navigate(showHref(type, id, a.getAttribute('title') || ''));
  }, true);

  // ---------- pagina Membri ----------

  function pageMembers() {
    return `<div class="container page disc-page">
      <h1 class="disc-title">Membri</h1>
      <p class="muted disc-sub">Toți cei care își țin jurnalul pe EDITSEL.</p>
      <div class="fh-search"><span>${icon('search')}</span><input id="mb-q" type="search" placeholder="Caută după nume sau username…" autocomplete="off"></div>
      <div class="sr-people" id="mb-list">${Array.from({ length: 6 }, () => '<div class="card friend-card skeleton"></div>').join('')}</div>
    </div>`;
  }

  async function fillMembersPage() {
    const box = document.getElementById('mb-list');
    if (!box) return;
    const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const members = (await backend.listMembers().catch(() => [])).filter((p) => p.username);
    if (!box.isConnected) return;
    const draw = () => {
      const q = norm(document.getElementById('mb-q').value.trim());
      const list = members.filter((p) => !q || norm(p.username).includes(q) || norm(p.name).includes(q));
      box.innerHTML = list.map((p) => `
        <a class="member-card" href="${BASE}${esc(p.username)}" style="--friend:${esc(p.accent || 'var(--accent)')}">
          <div class="member-banner" style="${p.banner && /^https?:|^data:/.test(p.banner) ? `background-image:url('${esc(p.banner)}')` : ''}"></div>
          <div class="member-body">
            ${p.avatar ? `<img class="avatar" src="${esc(p.avatar)}" alt="" loading="lazy">` : `<div class="avatar" style="color:${esc(p.accent || 'var(--accent)')}">${esc((p.name || p.username).charAt(0).toUpperCase())}</div>`}
            <div style="min-width:0"><b>${esc(p.name || p.username)}${backend.user && p.uid === backend.user.uid ? ' <span class="badge accent">tu</span>' : ''}</b><span class="muted">@${esc(p.username)}${p.bio ? ' · ' + esc(p.bio.slice(0, 50)) : ''}</span></div>
          </div></a>`).join('') || empty(q ? 'Niciun membru găsit.' : 'Încă nu s-a înscris nimeni.');
    };
    draw();
    document.getElementById('mb-q').addEventListener('input', draw);
  }

  // ---------- cautare pe telefon: ecran intreg care urca de jos ----------

  const RECENT_KEY = 'editsel_recent_search';
  const getRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
  const setRecent = (list) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* fara memorie locala */ } };
  const addRecent = (q) => setRecent([q, ...getRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())]);

  function openMobileSearch() {
    if (document.getElementById('msearch')) return;
    const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const wrap = document.createElement('div');
    wrap.id = 'msearch';
    wrap.className = 'msearch';
    wrap.innerHTML = `
      <div class="ms-bar">
        <div class="ms-field"><span>${icon('search')}</span><input type="search" id="ms-q" placeholder="Seriale, filme sau membri" autocomplete="off" enterkeyhint="search"><button type="button" class="ms-clear hidden" id="ms-clear" aria-label="Șterge">×</button></div>
        <button type="button" class="ms-cancel" id="ms-cancel">Anulează</button>
      </div>
      <div class="ms-body" id="ms-body"></div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => wrap.classList.add('open'));
    const input = wrap.querySelector('#ms-q');
    const body = wrap.querySelector('#ms-body');
    setTimeout(() => input.focus(), 60);

    const close = () => {
      wrap.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => wrap.remove(), 250);
    };
    wrap.querySelector('#ms-cancel').addEventListener('click', close);
    wrap.querySelector('#ms-clear').addEventListener('click', () => { input.value = ''; input.focus(); drawIdle(); });
    // linkurile din rezultate inchid ecranul (cele de adaugare deschid pop-up-ul peste el)
    body.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-recent]');
      if (chip) { input.value = chip.dataset.recent; run(); return; }
      if (e.target.closest('[data-clear-recent]')) { setRecent([]); drawIdle(); return; }
      const a = e.target.closest('a');
      if (a && !a.dataset.add) close();
    });

    const posterTile = (t) => `<a class="ms-tile" href="${esc(backend.user ? showHref(t.type, t.id, t.title) : `https://www.themoviedb.org/${t.type}/${t.id}`)}" ${backend.user ? `data-add="${t.type}:${t.id}"` : 'target="_blank" rel="noopener"'}>
        <img src="${esc(t.poster)}" alt="" loading="lazy"><span>${esc(t.title)}</span></a>`;

    async function drawIdle() {
      wrap.querySelector('#ms-clear').classList.add('hidden');
      const recent = getRecent();
      body.innerHTML = `${recent.length ? `<div class="ms-head"><h3>Căutări recente</h3><button type="button" data-clear-recent>Șterge</button></div>
          <div class="ms-chips">${recent.map((q) => `<button type="button" data-recent="${esc(q)}">${WL.ic('history')} ${esc(q)}</button>`).join('')}</div>` : ''}
        <div class="ms-head"><h3>Populare acum</h3></div><div class="ms-grid" id="ms-pop">${'<div class="ms-tile skeleton"></div>'.repeat(6)}</div>`;
      const home = await loadHomeData();
      const pop = document.getElementById('ms-pop');
      if (!pop) return;
      const list = [...(home.tv || []).slice(0, 6), ...(home.movie || []).slice(0, 6)].sort(() => Math.random() - 0.5).slice(0, 9);
      pop.innerHTML = list.length ? list.map(posterTile).join('') : '<div class="muted">Nimic deocamdată.</div>';
    }

    let timer = 0;
    let seq = 0;
    async function run() {
      const q = input.value.trim();
      wrap.querySelector('#ms-clear').classList.toggle('hidden', !q);
      if (!q) { drawIdle(); return; }
      const my = ++seq;
      body.innerHTML = '<div class="ms-loading"><span></span><span></span><span></span></div>';
      const nq = norm(q);
      const [members, titles, me] = await Promise.all([
        backend.listMembers().catch(() => []),
        backend.user
          ? api(`/api/tmdb/search?type=multi&q=${encodeURIComponent(q)}`).catch(() => [])
          : loadHomeData().then((h) => [...(h.tv || []), ...(h.movie || []), ...(h.popularTv || []), ...(h.popularMovie || [])]
            .filter((t) => norm(t.title).includes(nq)).map((t) => ({ ...t, tmdbId: t.id }))),
        backend.user ? api('/api/public').catch(() => null) : null,
      ]);
      if (my !== seq) return;
      const people = members.filter((p) => p.username && (norm(p.username).includes(nq) || norm(p.name).includes(nq))).slice(0, 12);
      const owned = (t) => me && me.titles.some((x) => x.tmdbId === t.tmdbId && x.type === t.type);
      const seen = new Set();
      const uniq = titles.filter((t) => { const k = t.type + t.tmdbId; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);
      body.innerHTML = `
        ${people.length ? `<div class="ms-head"><h3>Membri</h3></div><div class="ms-people">${people.map((p) => `
          <a href="${BASE}${esc(p.username)}">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : `<span style="color:${esc(p.accent || 'var(--accent)')}">${esc((p.name || p.username).charAt(0).toUpperCase())}</span>`}<b>${esc(p.name || p.username)}</b></a>`).join('')}</div>` : ''}
        ${uniq.length ? `<div class="ms-head"><h3>Seriale și filme</h3></div><div class="ms-list">${uniq.map((t) => `
          <a class="ms-row" href="${esc(backend.user ? showHref(t.type, t.tmdbId, t.title) : `https://www.themoviedb.org/${t.type}/${t.tmdbId}`)}" ${backend.user ? `data-add="${t.type}:${t.tmdbId}"` : 'target="_blank" rel="noopener"'}>
            ${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : '<span class="ms-noimg"></span>'}
            <span class="ms-info"><b>${esc(t.title)}</b><small>${esc(t.year || '—')} · ${t.type === 'tv' ? 'Serial' : 'Film'}${owned(t) ? ' · <em>în biblioteca ta</em>' : ''}</small></span>
            ${backend.user ? `<span class="ms-add">${WL.ic(owned(t) ? 'check' : 'plus')}</span>` : '<span class="ms-add">›</span>'}
          </a>`).join('')}</div>` : ''}
        ${!people.length && !uniq.length ? '<div class="ms-empty"><b>Nu am găsit nimic</b><span>Încearcă alt nume.</span></div>' : ''}
        ${!backend.user ? '<div class="ms-hint"><a href="signup">Fă-ți cont</a> ca să cauți orice serial sau film și să-l adaugi în jurnal.</div>' : ''}
        <a class="ms-all" href="${BASE}search?q=${encodeURIComponent(q)}">Toate rezultatele pentru „${esc(q)}” ›</a>`;
    }

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 280); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        const q = input.value.trim();
        addRecent(q);
        close();
        navigate(`${BASE}search?q=${encodeURIComponent(q)}`);
      }
      if (e.key === 'Escape') close();
    });
    // cand deschizi un rezultat, cautarea ramane in „recente”
    body.addEventListener('click', (e) => { if (e.target.closest('a') && input.value.trim()) addRecent(input.value.trim()); }, true);
    drawIdle();
  }

  // ---------- router ----------

  let backend = null;
  let loadedUser = null;
  let renderToken = 0;

  function setNav(active) {
    document.querySelectorAll('.main-nav a, .bottom-nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === active));
  }

  function navigate(url, replace = false) {
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    render();
  }

  const titleId = (seg) => String(seg || '').split('-').pop();

  function done() {
    document.body.classList.remove('loading');
  }

  const ACCOUNT_PAGE = /^\/(login|signup|settings|admin)\/?$/;
  // adresele vechi in romana -> cele noi in engleza
  const OLD_TOP = { descopera: 'discover', membri: 'members', prieteni: 'friends', cauta: 'search' };
  const OLD_SUB = { seriale: 'shows', filme: 'movies', recenzii: 'reviews', aprecieri: 'likes', jurnal: 'diary', liste: 'lists', lista: 'list', statistici: 'stats', prieteni: 'friends', serial: 'show', film: 'movie' };
  const OLD_DISC = { 'seriale-populare': 'popular-shows', 'seriale-in-trend': 'trending-shows', 'filme-populare': 'popular-movies', 'filme-in-trend': 'trending-movies', 'seriale-apreciate': 'top-shows', 'filme-apreciate': 'top-movies' };
  function oldRoute(parts) {
    if (!parts.length) return null;
    const p = [...parts];
    if (OLD_TOP[p[0]]) p[0] = OLD_TOP[p[0]];
    else if (p[1] && OLD_SUB[p[1]]) p[1] = OLD_SUB[p[1]];
    if (p[0] === 'discover' && OLD_DISC[p[1]]) p[1] = OLD_DISC[p[1]];
    return p.join('/') === parts.join('/') ? null : p.join('/');
  }

  async function render() {
    const token = ++renderToken;
    const rel = decodeURIComponent(location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname.slice(1));
    const parts = rel.split('/').filter(Boolean);
    // /add/tv/1405: deschide pop-up-ul de adaugare peste Descopera
    if (parts[0] === 'add' && parts[2]) return navigate(showHref(parts[1], parts[2]), true);
    if ((parts[0] === 'show' || parts[0] === 'movie') && parseInt(parts[1], 10)) {
      applyAccent(WL.COLORS[0][1]);
      loadedUser = null;
      document.body.classList.remove('on-discover');
      setNav('');
      window.scrollTo(0, 0);
      done();
      fillShowPage(parts[0] === 'movie' ? 'movie' : 'tv', parseInt(parts[1], 10), token);
      return;
    }
    if (ACCOUNT_PAGE.test(location.pathname) && !sessionStorage.getItem('editsel_acct')) {
      sessionStorage.setItem('editsel_acct', '1');
      location.reload();
      return;
    }
    sessionStorage.removeItem('editsel_acct');
    const old = oldRoute(parts);
    if (old) return navigate(BASE + old + location.search + location.hash, true);

    // fara cont: pagina de prezentare; cu cont (sau /descopera): pagina Descopera
    if (!parts.length || parts[0] === 'discover') {
      applyAccent(WL.COLORS[0][1]);
      loadedUser = null;
      const discover = parts[0] === 'discover' || backend.user;
      app.innerHTML = discover ? pageDiscover(parts[1]) : pageHome();
      document.body.classList.toggle('on-discover', Boolean(discover));
      document.title = discover ? 'Descoperă · EDITSEL' : 'EDITSEL · Jurnal de seriale și filme';
      done();
      window.scrollTo(0, 0);
      if (discover) fillDiscover(parts[1]); else fillHome();
      setNav(discover ? 'descopera' : 'acasa');
      return;
    }
    if (parts[0] === 'members') {
      applyAccent(WL.COLORS[0][1]);
      loadedUser = null;
      document.body.classList.add('on-discover');
      app.innerHTML = pageMembers();
      document.title = 'Membri · EDITSEL';
      done();
      window.scrollTo(0, 0);
      setNav('membri');
      fillMembersPage();
      return;
    }
    if (parts[0] === 'friends') {
      applyAccent(WL.COLORS[0][1]);
      loadedUser = null;
      document.body.classList.add('on-discover');
      app.innerHTML = pageFriendsHub();
      document.title = 'Prieteni · EDITSEL';
      done();
      window.scrollTo(0, 0);
      setNav('prieteni');
      if (backend.user) fillFriendsHub();
      return;
    }
    if (parts[0] === 'calendar') {
      applyAccent(WL.COLORS[0][1]);
      loadedUser = null;
      document.body.classList.add('on-discover');
      app.innerHTML = pageCalendar();
      document.title = 'Calendar · EDITSEL';
      done();
      window.scrollTo(0, 0);
      setNav('calendar');
      if (backend.user) {
        fillCalendar();
        document.getElementById('cal-refresh').addEventListener('click', (e) => {
          e.currentTarget.disabled = true;
          document.getElementById('cal-body').innerHTML = Array.from({ length: 4 }, () => '<div class="cal-row skeleton"></div>').join('');
          fillCalendar(true);
        });
      }
      return;
    }
    if (parts[0] === 'search') {
      const q = new URLSearchParams(location.search).get('q') || '';
      applyAccent(WL.COLORS[0][1]);
      loadedUser = null;
      app.innerHTML = pageSearch(q);
      document.title = `„${q}” · Căutare · EDITSEL`;
      done();
      window.scrollTo(0, 0);
      setNav('');
      fillSearch(q);
      return;
    }
    document.body.classList.remove('on-discover');
    setNav('');

    const username = parts[0].toLowerCase();
    if (loadedUser !== username) {
      if (!document.body.classList.contains('loading')) app.innerHTML = '<div class="page-loading"></div>';
      let data;
      try { data = await backend.loadUser(username); } catch (e) { data = { error: e }; }
      if (token !== renderToken) return;
      if (!data || data.error) {
        done();
        app.innerHTML = `<div class="container page" style="padding-top:140px;text-align:center">
          <h1 style="font-size:28px">${data && data.error ? 'Nu am putut încărca profilul' : 'Profil inexistent'}</h1>
          <p class="muted">${data && data.error ? esc(data.error.message) : `Nu există niciun utilizator @${esc(username)}.`}</p>
          <a class="btn" href="./">‹ Pagina principală</a></div>`;
        document.title = 'EDITSEL';
        loadedUser = null;
        return;
      }
      DB = data;
      byId = new Map(DB.titles.map((t) => [t.id, t]));
      U = DB.profile.username || username;
      loadedUser = username;
      applyAccent(DB.profile.accent);
      try { localStorage.setItem('editsel_accent', DB.profile.accent || ''); } catch {}
    }
    done();

    if (DB.private) {
      app.innerHTML = `<div class="container page" style="padding-top:140px;text-align:center">
        <h1 style="font-size:28px">@${esc(username)}</h1>
        <p class="muted private-note">${WL.ic('lock')} Profilul ăsta este privat.</p><a class="btn" href="./">‹ Pagina principală</a></div>`;
      document.title = 'EDITSEL';
      return;
    }
    if (parts[0] !== U) return navigate(BASE + U + rel.slice(parts[0].length) + location.search, true);

    parts.shift();
    const q = new URLSearchParams(location.search);
    let html;
    let title = DB.profile.name;
    switch (parts[0]) {
      case undefined: html = pageProfile(); break;
      case 'shows': html = pageLibrary('tv', q); title += ' · Seriale'; break;
      case 'movies': html = pageLibrary('movie', q); title += ' · Filme'; break;
      case 'reviews': html = pageReviews(); title += ' · Recenzii'; break;
      case 'likes': html = pageLikes(); title += ' · Aprecieri'; break;
      case 'diary': html = pageDiary(q); title += ' · Jurnal'; break;
      case 'lists': html = pageLists(); title += ' · Liste'; break;
      case 'list': html = pageList(parts[1]); title += ' · Listă'; break;
      case 'friends': html = pageFriends(); title += ' · Prieteni'; break;
      case 'stats': html = DB.profile.showStats === false ? pageProfile() : pageStats(); title += ' · Statistici'; break;
      case 'year': html = DB.profile.showStats === false ? pageProfile() : pageYear(parts[1]); title += ' · Anul în seriale'; break;
      case 'show':
      case 'movie': {
        parts[1] = titleId(parts[1]);
        const t = byId.get(parts[1]);
        if (t && backend.user && DB.uid === backend.user.uid) {
          drawShowPage({ t, owned: true, profilePage: true });
          document.title = `${t.title} · ${DB.profile.name}`;
          loadProviders(t);
          window.scrollTo(0, 0);
          return;
        }
        html = pageTitle(parts[1]);
        if (t) title = `${t.title} · ${DB.profile.name}`;
        parts[0] = 't';
        break;
      }
      default: html = pageProfile();
    }
    app.innerHTML = html;
    document.title = title;
    if (parts[0] === 't') loadProviders(byId.get(parts[1]));
    fillFriendsSidebar();
    fillFollowButton();
    fillComments();
    if (parts[0] === 'friends') fillFriendsPage();
    const share = document.getElementById('yr-share');
    if (share) share.addEventListener('click', async () => {
      const url = location.origin + location.pathname;
      const text = `${DB.profile.name} · ${share.closest('.page').querySelector('.yr-hero h2').textContent} în seriale pe EDITSEL`;
      if (navigator.share) { navigator.share({ title: text, url }).catch(() => {}); return; }
      try { await navigator.clipboard.writeText(url); toast('Link copiat'); } catch { prompt('Copiază linkul:', url); }
    });
    // pe telefon tab-urile se deruleaza: tab-ul activ adus in centru
    const tabsEl = app.querySelector('.tabs');
    const activeTab = tabsEl && tabsEl.querySelector('a.active');
    if (activeTab) tabsEl.scrollLeft = activeTab.offsetLeft - (tabsEl.clientWidth - activeTab.offsetWidth) / 2;
    window.scrollTo(0, 0);
  }

  // evenimente delegate
  app.addEventListener('change', (ev) => {
    if (ev.target.id === 'sort') {
      navigate(`${ev.target.dataset.route}?status=${ev.target.dataset.status}&sort=${ev.target.value}`);
    }
    if (ev.target.id === 'diary-filter') navigate(R(`/diary?tip=${ev.target.value}`));
  });
  app.addEventListener('click', (ev) => {
    const sp = ev.target.closest('.spoiler');
    if (sp && ev.target.closest('.text')) sp.classList.add('revealed');
  });

  // popup unic despre API-ul TMDB (se tine minte in browser dupa „Am inteles”)
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('footer-search').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (window.matchMedia('(max-width: 640px)').matches) { openMobileSearch(); return; } window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('#hsearch .hs-toggle').click(); });
  document.getElementById('to-top').addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  const NOTICE_KEY = 'editsel_api_notice_v1';
  const notice = document.getElementById('api-notice');
  let seen = false;
  try { seen = localStorage.getItem(NOTICE_KEY) === '1'; } catch {}
  if (!seen) notice.classList.remove('hidden');
  const closeNotice = () => {
    notice.classList.add('hidden');
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch {}
  };
  document.getElementById('api-notice-ok').addEventListener('click', closeNotice);
  notice.addEventListener('click', (e) => { if (e.target === notice) closeNotice(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !notice.classList.contains('hidden')) closeNotice(); });

  const header = document.getElementById('header');
  window.addEventListener('scroll', () => header.classList.toggle('solid', window.scrollY > 40), { passive: true });
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href]');
    if (!a || a.target || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    // pagina de cont e alta pagina (admin.html), nu o ruta a aplicatiei
    if (ACCOUNT_PAGE.test(url.pathname)) return;
    ev.preventDefault();
    if (url.pathname + url.search !== location.pathname + location.search) navigate(url.pathname + url.search);
  });
  window.addEventListener('popstate', render);

  // ---------- instalare pe telefon (ecranul principal) ----------
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; showInstall(); });
  window.addEventListener('appinstalled', () => { installEvt = null; hideInstall(true); });
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function hideInstall(forever) {
    const el = document.getElementById('install-bar');
    if (el) el.remove();
    if (forever) try { localStorage.setItem('editsel_install_off', String(Date.now())); } catch { /* */ }
  }
  function showInstall() {
    if (standalone() || document.getElementById('install-bar') || !window.matchMedia('(max-width: 760px)').matches) return;
    try { const off = Number(localStorage.getItem('editsel_install_off')); if (off && Date.now() - off < 14 * 864e5) return; } catch { /* */ }
    const ios = isIos();
    if (!installEvt && !ios) return;
    const share = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    document.body.insertAdjacentHTML('beforeend', `<div class="install-bar" id="install-bar" role="dialog" aria-label="Instalează EDITSEL">
      <img src="${BASE}brand/app-192.png" alt="">
      <div class="install-txt">${ios ? `<b>Adaugă pe ecran</b><span><i class="install-ic">${share}</i> → „Adaugă pe ecranul principal”</span>` : '<b>Instalează aplicația EDITSEL</b>'}</div>
      ${ios ? '' : '<button class="btn small primary" id="install-go" type="button">Instalează</button>'}
      <button class="install-x" id="install-x" type="button" aria-label="Închide">${WL.ic('x')}</button>
    </div>`);
    document.getElementById('install-x').addEventListener('click', () => hideInstall(true));
    const go = document.getElementById('install-go');
    if (go) go.addEventListener('click', async () => {
      if (!installEvt) return;
      installEvt.prompt();
      const r = await installEvt.userChoice.catch(() => null);
      installEvt = null;
      hideInstall(Boolean(r && r.outcome === 'dismissed'));
    });
  }
  setTimeout(() => { if (isIos()) showInstall(); }, 2500);

  // inainte sa raspunda Firebase: bara de jos, meniul si butoanele contului ca la ultima vizita (nu mai sar la reincarcare)
  (function earlyAuthUi() {
    let me = null;
    try { me = JSON.parse(localStorage.getItem('editsel_me') || 'null'); } catch { /* fara localStorage */ }
    document.body.classList.toggle('logged-out', !me);
    swapNav(Boolean(me));
    if (!me) return;
    const bn = document.getElementById('bn-profile');
    if (bn && me.username) { bn.href = BASE + me.username; bn.innerHTML = `<span>${icon('user')}</span>Profil`; }
    const slot = document.getElementById('auth-slot');
    if (slot && !slot.innerHTML.trim()) slot.innerHTML = authSlotHtml(me);
  })();

  WL.backend().then((b) => {
    if (!b || !b.api) {
      done();
      app.innerHTML = `<div class="container page" style="padding-top:140px;text-align:center">
        <h1 style="font-size:26px">Site-ul nu e conectat încă</h1>
        <p class="muted">${b && b.missingConfig ? 'Lipsește configurarea Firebase (firebase-config.js).' : 'Nu am putut porni conexiunea cu baza de date.'}</p></div>`;
      return;
    }
    backend = b;
    if (location.hash.startsWith('#/')) history.replaceState(null, '', BASE);
    renderAuthSlot();
    setupSearch();
    document.getElementById('bn-search').addEventListener('click', (e) => { e.stopPropagation(); openMobileSearch(); });
    b.onAuth(() => { renderAuthSlot(); loadedUser = null; userCache.clear(); render(); });
    render();
  });
})();
