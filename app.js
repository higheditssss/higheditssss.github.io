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

  function allReviews() {
    const out = [];
    for (const t of DB.titles) {
      if (t.review && t.review.trim()) {
        out.push({ t, text: t.review, rating: t.rating, liked: t.liked, spoiler: t.spoiler, date: (t.updatedAt || t.addedAt || '').slice(0, 10), scope: '' });
      }
    }
    for (const e of DB.diary) {
      const t = byId.get(e.titleId);
      if (t && e.review && e.review.trim()) {
        out.push({ t, text: e.review, rating: e.rating, liked: e.liked, spoiler: e.spoiler, date: e.date, scope: scopeLabel(e, t), rewatch: e.rewatch });
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
          <a href="${R('/shows?status=watched')}"><span class="ic">👁</span>Văzute<span class="val">${watched}</span></a>
          <a href="${R('/shows?status=watchlist')}"><span class="ic">🕒</span>De văzut<span class="val">${watchlist}</span></a>
          <a href="${R('/reviews')}"><span class="ic">★</span>Ratinguri<span class="val">${ratings.length + DB.diary.filter((e) => e.rating).length}</span></a>
          <a href="${R('/stats')}"><span class="ic">▤</span>Toate statisticile<span class="val">›</span></a>
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
          ${r.rewatch ? '<span class="badge">↻ revăzut</span>' : ''}
          ${r.spoiler ? '<span class="badge">spoiler — click ca să vezi</span>' : ''}
          <span>${fmtDate(r.date)}</span>
        </div>
        <div class="text">${esc(r.text)}</div>
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

    const filters = [['all', { short: 'Toate', icon: '▦' }], ...Object.entries(STATUS)]
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
          <div class="diary-flags">${e.rewatch ? '<span title="Revăzut">↻</span>' : ''}${e.review ? '<span title="Are recenzie">≡</span>' : ''}${stars(e.rating, 'accent')}${heart(e.liked)}</div>
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

    return shell('stats', `
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

  function pageTitle(id) {
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
      ${t.liked || t.favorite ? `<div class="row"><span class="muted">Marcaje</span><span>${t.liked ? '<span class="heart">♥</span> Îmi place' : ''}${t.liked && t.favorite ? ' · ' : ''}${t.favorite ? '★ Favorit' : ''}</span></div>` : ''}
      ${isTv && epsTotal ? `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between"><span class="muted">Episoade</span><span>${epsDone} / ${epsTotal}</span></div><div class="progress"><div style="width:${Math.min(100, (epsDone / epsTotal) * 100)}%"></div></div></div>` : ''}
      <div class="row"><span class="muted">Adăugat</span><span>${fmtDate(t.addedAt)}</span></div>
      ${t.note ? `<div class="row" style="display:block"><span class="muted">Notiță</span><div style="white-space:pre-line;margin-top:4px">${esc(t.note)}</div></div>` : ''}
    </div>`;

    const creators = (t.creators || []).length
      ? `<div class="card"><h3>${isTv ? 'Creat de' : 'Regia'}</h3>${t.creators.map(esc).join(', ')}${(t.networks || []).length ? `<div class="muted" style="margin-top:8px;font-size:13px">${t.networks.map(esc).join(', ')}</div>` : ''}</div>` : '';

    const listsCard = inLists.length
      ? `<div class="card"><h3>Apare în liste</h3>${inLists.map((l) => `<a href="${R('/list/' + l.id)}" style="display:block;padding:4px 0;color:var(--accent-text)">${esc(l.name)}</a>`).join('')}</div>` : '';

    const review = t.review
      ? section('Recenzia mea', reviewItem({ t, text: t.review, rating: t.rating, liked: t.liked, spoiler: t.spoiler, date: (t.updatedAt || '').slice(0, 10), scope: '' }, false))
      : '';

    const diary = entries.length
      ? section('Din jurnal', `<div class="diary-box">${entries.map((e) => {
          const d = parseDate(e.date);
          return `<div class="diary-row" style="grid-template-columns:54px minmax(0,1fr) auto">
            <div class="diary-day"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}</span></div>
            <div style="min-width:0"><div class="diary-title">${esc(scopeLabel(e, t))}${e.rewatch ? ' <span class="badge">↻ revăzut</span>' : ''}</div>${e.review ? `<div class="diary-sub ${e.spoiler ? 'spoiler' : ''}"><div class="text">${esc(e.review)}</div></div>` : ''}</div>
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
          <aside class="sidebar">${myCard}<div id="providers"></div>${creators}${listsCard}</aside>
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
        <div class="diary-flags">${e.rewatch ? '<span title="Revăzut">↻</span>' : ''}${e.review ? '<span title="Are recenzie">≡</span>' : ''}${stars(e.rating, 'accent')}${heart(e.liked)}</div>
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
      slot.innerHTML = '<a class="btn small" href="settings">✎ Editează profilul</a>';
      return;
    }
    let me;
    try { me = await api('/api/public'); } catch { return; }
    if (!slot.isConnected) return;
    const target = { uid: DB.uid, profile: DB.profile };
    const draw = () => {
      const rel = relation(me, target);
      const buttons = {
        friends: '<button class="btn small" data-act="cancel" data-confirm="1">✓ Prieteni</button>',
        sent: '<button class="btn small" data-act="cancel">Cerere trimisă · Anulează</button>',
        received: '<button class="btn small primary" data-act="add">✓ Acceptă cererea</button><button class="btn small ghost" data-act="decline">Refuză</button>',
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
    const [members, me] = await Promise.all([backend.listMembers().catch(() => []), api('/api/public').catch(() => null)]);
    if (!me) return null;
    const others = members.filter((p) => p.username && p.uid !== backend.user.uid);
    const items = [];
    for (const p of others) {
      const rel = relation(me, p);
      if (rel === 'received') items.push({ id: 'r:' + p.uid, type: 'request', p });
      if (rel === 'friends') items.push({ id: 'f:' + p.uid, type: 'friend', p });
    }
    // cererile primite sunt mereu sus
    items.sort((a, b) => (a.type === b.type ? 0 : a.type === 'request' ? -1 : 1));
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
               <div class="follow-btns"><button class="btn small primary" data-act="add">✓ Acceptă</button><button class="btn small ghost" data-act="decline">Refuză</button></div>`
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
      // prieteniile noi se considera vazute odata ce deschizi clopotelul
      const seen = getSeen();
      notifState.items.filter((n) => n.type === 'friend').forEach((n) => seen.add(n.id));
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

  function swapNav(logged) {
    document.querySelectorAll('.main-nav a[data-nav="descopera"], .main-nav a[data-nav="membri"], .bottom-nav a[data-nav="descopera"], .bottom-nav a[data-nav="membri"]').forEach((a) => {
      const bottom = a.closest('.bottom-nav');
      a.dataset.nav = logged ? 'membri' : 'descopera';
      a.setAttribute('href', logged ? 'members' : 'discover');
      a.innerHTML = (bottom ? `<span>${icon(logged ? 'list' : 'compass')}</span>` : '') + (logged ? 'Membri' : 'Descoperă');
    });
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
    const bn = document.getElementById('bn-profile');
    if (bn && username) { bn.href = BASE + username; bn.innerHTML = `<span>${icon('user')}</span>Profil`; }
    slot.innerHTML = authSlotHtml(myP ? { username, name: myP.name, avatar: myP.avatar } : {});
    setupBell();
    updateRequestBadge();
  }

  // ---------- pagina principala ----------

  const FEATURES = [
    ['▤', 'Jurnal', 'Notează fiecare episod și film văzut, cu dată, notă și ♥. Totul ordonat pe luni.'],
    ['★', 'Note și recenzii', 'Stele cu jumătăți, recenzii cu spoilere ascunse și note pe fiecare sezon.'],
    ['☰', 'Liste', 'Topuri, colecții, „de văzut în weekend” — liste numerotate sau simple.'],
    ['☺', 'Prieteni', 'Adaugă-ți prietenii și vezi ce au văzut și cât de mult le-a plăcut.'],
  ];

  function pageHome() {
    const logged = backend.user;
    const cta = logged
      ? '<a class="btn primary" href="settings">＋ Adaugă seriale</a><a class="btn" id="home-my" href="./">Profilul meu</a>'
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
          <div class="poster-img"><img src="${esc(t.poster)}" alt="${esc(t.title)}" loading="lazy">${t.rating ? `<span class="tmdb-score">★ ${t.rating.toFixed(1)}</span>` : ''}</div>
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
      ? `${BASE}add/${t.type}/${t.tmdbId}`
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
          ${backend.user ? `<span class="hs-action">${owned(t) ? 'Editează' : '＋ Adaugă'}</span>` : ''}</a>`).join('');

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
    const href = backend.user ? `${BASE}add/${t.type}/${t.id}` : `https://www.themoviedb.org/${t.type}/${t.id}`;
    return `<a class="poster disc-card" href="${esc(href)}" ${backend.user ? `data-add="${t.type}:${t.id}"` : 'target="_blank" rel="noopener"'} title="${esc(t.title)}${t.year ? ' (' + esc(t.year) + ')' : ''}">
      <div class="poster-img"><img src="${esc(t.poster)}" alt="${esc(t.title)}" loading="lazy">
        <div class="disc-over"><b>${esc(t.title)}</b><span>${esc(t.year || '')}${t.rating ? ' · ★ ' + t.rating.toFixed(1) : ''}</span>
          ${backend.user ? `<em>${owned ? '✓ În biblioteca ta' : '＋ Adaugă'}</em>` : ''}</div>
      </div></a>`;
  }

  // bannerul zilei: azi (prima zi) The Mentalist, apoi in fiecare zi alt serial ales dupa data
  const MENTALIST = { id: 5920, type: 'tv', title: 'The Mentalist',
    backdrops: ['rJFqKcmMSttdNP58l0dVzY2NcTA', 'jh9YpYaG1be7FOtBUxkLTIkhQHI', 'ov0WjAg0CclTDLBPy36nBiJ1fN5', 'xFzmU1h2aKPKobNGIgzZSRxCkwE', '1mOt9QtVJAAeFD4mF33Bpr2Msv7', 'kAgork03BAj6Q1NBrsWh4ppK0yi']
      .map((p) => 'https://image.tmdb.org/t/p/w1280/' + p + '.jpg') };
  const bannerDay = () => {
    const now = new Date();
    return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 9, 21)) / 864e5);
  };
  // ce se stie deja fara sa astepti baza de date: { t, slides } sau null
  function bannerNow() {
    const day = bannerDay();
    if (day <= 0) return { t: MENTALIST, slides: MENTALIST.backdrops };
    try {
      const c = JSON.parse(localStorage.getItem('editsel_banner') || 'null');
      if (c && c.day === day && c.slides && c.slides.length) return { t: c.t, slides: c.slides };
    } catch { /* fara localStorage */ }
    return null;
  }
  function bannerOfDay(home) {
    const day = bannerDay();
    const seen = new Set();
    const pool = [...(home.topTv || []), ...(home.popularTv || []), ...(home.tv || [])]
      .filter((t) => t.backdrop && t.id !== MENTALIST.id && !seen.has(t.id) && seen.add(t.id))
      .sort((a, b) => a.id - b.id);
    if (day <= 0 || !pool.length) return MENTALIST;
    return pool[(day * 7919) % pool.length];
  }
  let heroTimer = null;
  function bannerTitle(t) {
    const href = backend.user ? `${BASE}add/${t.type}/${t.id}` : `https://www.themoviedb.org/${t.type}/${t.id}`;
    return `<a href="${esc(href)}" ${backend.user ? `data-add="${t.type}:${t.id}"` : 'target="_blank" rel="noopener"'}>${esc(t.title)}</a>`;
  }

  // caruselul cu fade: fundalurile serialului zilei, schimbate la 6 secunde
  async function fillBanner(home) {
    const heroBox = document.getElementById('disc-hero');
    clearInterval(heroTimer);
    if (!heroBox) return;
    const b = bannerOfDay(home);
    const slides = b.backdrops || await backend.bannerImages(b).catch(() => [b.backdrop]);
    if (!heroBox.isConnected) return;
    try { localStorage.setItem('editsel_banner', JSON.stringify({ day: bannerDay(), t: { id: b.id, type: b.type, title: b.title }, slides })); } catch { /* fara localStorage */ }
    heroBox.innerHTML = slides.map((src, i) => `<div class="disc-slide${i ? '' : ' on'}" style="background-image:url('${esc(src)}')"></div>`).join('');
    document.getElementById('disc-hero-name').innerHTML = bannerTitle(b);
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
    const now0 = one ? null : bannerNow();
    const head = one
      ? `<a class="see-all" href="${BASE}discover">‹ Descoperă</a><h1 class="disc-title">${one[1]}</h1>`
      : `<h1 class="disc-title disc-banner-title" id="disc-hero-name">${now0 ? bannerTitle(now0.t) : '&nbsp;'}</h1>`;
    const rows = (one ? [one] : DISCOVER).map(([key, label]) => `<section class="section disc-section" data-key="${key}">
        ${one ? '' : `<div class="section-head"><h2>${label}</h2><a class="see-all" href="${BASE}discover/${key}">Vezi tot ›</a></div>`}
        <div class="${one ? 'grid lg' : 'disc-row'}" id="disc-${key}">${Array.from({ length: one ? 20 : 8 }, () => '<div class="poster"><div class="poster-img skeleton"></div></div>').join('')}</div>
      </section>`).join('');
    const now = one ? null : bannerNow();
    const hero = one ? '' : `<div class="hero disc-hero" id="disc-hero">${now ? `<div class="disc-slide on" style="background-image:url('${esc(now.slides[0])}')"></div>` : ''}</div>`;
    return `${hero}<div class="container page disc-page${one ? '' : ' has-banner'}">${head}${rows}
    </div>`;
  }

  async function fillDiscover(listKey) {
    const [home, me] = await Promise.all([
      loadHomeData(),
      backend.user ? api('/api/public').catch(() => null) : null,
    ]);
    const owned = (t) => me && me.titles.some((x) => x.tmdbId === t.id && x.type === t.type);
    fillBanner(home || {});
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
        : `<a class="poster disc-card" href="${esc(backend.user ? `${BASE}add/${t.type}/${t.tmdbId}` : '#')}"><div class="poster-img"><div class="poster-fallback"><span>${esc(t.title)}</span></div></div></a>`)).join('');
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
      received: '<button class="btn small primary" data-act="add">✓ Acceptă</button><button class="btn small ghost" data-act="decline">Refuză</button>',
      friends: '<button class="btn small" data-act="cancel" data-confirm="1">✓ Prieteni</button>',
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
    container.innerHTML = `<span class="star-input ${small ? 'sm' : ''}">${'<span class="s">★</span>'.repeat(5)}<span class="val"></span></span>`;
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

  async function quickAdd(type, tmdbId, sourceEl) {
    if (!backend || !backend.user) { location.href = 'signup'; return; }
    const loading = openModal('<div class="modal-body"><div class="muted">Se încarcă…</div></div>');
    let me;
    let details;
    try {
      me = await api('/api/public');
      const existing = me.titles.find((t) => t.type === type && t.tmdbId === Number(tmdbId));
      details = existing || await api(`/api/tmdb/details?type=${type}&id=${tmdbId}`);
      loading.close();
      showQuickAdd(details, Boolean(existing), sourceEl);
    } catch (e) {
      loading.close();
      toast(e.message, true);
    }
  }

  function showQuickAdd(t, isExisting, sourceEl) {
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
        </div>
      </div>
      <div class="modal-body">
        <div class="field"><span class="lbl">Status</span>
          <div class="seg" id="qa-status">${Object.entries(STATUS).map(([k, s]) => `<button type="button" data-v="${k}" class="${d.status === k ? 'on' : ''}">${s.icon} ${s.label}</button>`).join('')}</div>
        </div>
        <div class="row-fields">
          <div class="field"><span class="lbl">Notă</span><div id="qa-rating"></div></div>
          <div class="field"><span class="lbl">Îți place?</span><div><button type="button" class="toggle like ${d.liked ? 'on' : ''}" id="qa-like">♥ Îmi place</button></div></div>
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
          <div class="field"><span class="lbl">Favorit</span><div><button type="button" class="toggle fav ${d.favorite ? 'on' : ''}" id="qa-fav">★ Favorit</button></div></div>
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
        <button type="button" class="btn ghost" id="qa-more-btn">Mai multe opțiuni ▾</button>
        <span class="grow"></span>
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
      e.currentTarget.textContent = more.classList.contains('hidden') ? 'Mai multe opțiuni ▾' : 'Mai puține opțiuni ▴';
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
        const mark = sourceEl && sourceEl.querySelector('.disc-over em, .hs-action');
        if (mark) mark.textContent = '✓ În biblioteca ta';
      } catch (err) {
        e.target.disabled = false;
        toast(err.message, true);
      }
    });
  }

  // orice link „adauga” de pe site deschide pop-up-ul in loc sa schimbe pagina
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[data-add]');
    if (!a || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const [type, id] = a.dataset.add.split(':');
    const box = document.getElementById('hs-results');
    if (box) box.classList.add('hidden');
    quickAdd(type, id, a);
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

    const posterTile = (t) => `<a class="ms-tile" href="${esc(backend.user ? `${BASE}add/${t.type}/${t.id}` : `https://www.themoviedb.org/${t.type}/${t.id}`)}" ${backend.user ? `data-add="${t.type}:${t.id}"` : 'target="_blank" rel="noopener"'}>
        <img src="${esc(t.poster)}" alt="" loading="lazy"><span>${esc(t.title)}</span></a>`;

    async function drawIdle() {
      wrap.querySelector('#ms-clear').classList.add('hidden');
      const recent = getRecent();
      body.innerHTML = `${recent.length ? `<div class="ms-head"><h3>Căutări recente</h3><button type="button" data-clear-recent>Șterge</button></div>
          <div class="ms-chips">${recent.map((q) => `<button type="button" data-recent="${esc(q)}">↺ ${esc(q)}</button>`).join('')}</div>` : ''}
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
          <a class="ms-row" href="${esc(backend.user ? `${BASE}add/${t.type}/${t.tmdbId}` : `https://www.themoviedb.org/${t.type}/${t.tmdbId}`)}" ${backend.user ? `data-add="${t.type}:${t.tmdbId}"` : 'target="_blank" rel="noopener"'}>
            ${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : '<span class="ms-noimg"></span>'}
            <span class="ms-info"><b>${esc(t.title)}</b><small>${esc(t.year || '—')} · ${t.type === 'tv' ? 'Serial' : 'Film'}${owned(t) ? ' · <em>în biblioteca ta</em>' : ''}</small></span>
            ${backend.user ? `<span class="ms-add">${owned(t) ? '✓' : '＋'}</span>` : '<span class="ms-add">›</span>'}
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
    if (parts[0] === 'add' && parts[2]) {
      history.replaceState(null, '', BASE + 'discover');
      render();
      if (backend.user) quickAdd(parts[1], parts[2]); else location.href = 'signup';
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
      setNav(parts[0] === 'discover' ? 'descopera' : 'acasa');
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
        <p class="muted">🔒 Profilul ăsta este privat.</p><a class="btn" href="./">‹ Pagina principală</a></div>`;
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
      case 'show':
      case 'movie': {
        parts[1] = titleId(parts[1]);
        html = pageTitle(parts[1]);
        const t = byId.get(parts[1]);
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
    if (parts[0] === 'friends') fillFriendsPage();
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
