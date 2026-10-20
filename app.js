// Pagina publica: profilurile membrilor (citire). Fiecare isi editeaza profilul din admin.html, dupa logare.
(function () {
  const { applyAccent, esc, STATUS, MONTHS, DAYS, parseDate, fmtDate, stars, heart, poster, watchTime, splitMinutes, histogram, api } = WL;
  const app = document.getElementById('app');

  let DB = null;
  let byId = new Map();

  // adrese curate, fara #: /<username>, /<username>/seriale, /<username>/serial/dexter-<id>
  const BASE = (document.querySelector('base') && document.querySelector('base').getAttribute('href')) || '/';
  const slug = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  let U = 'profil';
  const R = (p = '') => BASE + U + (p === '/' ? '' : p);
  const titleHref = (t) => R(`/${t.type === 'movie' ? 'film' : 'serial'}/${slug(t.title) || 'titlu'}-${t.id}`);
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
    ['seriale', 'Seriale', R('/seriale')],
    ['filme', 'Filme', R('/filme')],
    ['recenzii', 'Recenzii', R('/recenzii')],
    ['likes', 'Aprecieri', R('/aprecieri')],
    ['jurnal', 'Jurnal', R('/jurnal')],
    ['liste', 'Liste', R('/liste')],
    ['stats', 'Statistici', R('/statistici')],
    ['prieteni', 'Prieteni', R('/prieteni')],
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
          <a href="${R('/seriale?status=watched')}"><span class="ic">👁</span>Văzute<span class="val">${watched}</span></a>
          <a href="${R('/seriale?status=watchlist')}"><span class="ic">🕒</span>De văzut<span class="val">${watchlist}</span></a>
          <a href="${R('/recenzii')}"><span class="ic">★</span>Ratinguri<span class="val">${ratings.length + DB.diary.filter((e) => e.rating).length}</span></a>
          <a href="${R('/statistici')}"><span class="ic">▤</span>Toate statisticile<span class="val">›</span></a>
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
    return `<a class="list-card" href="${R('/lista/' + l.id)}">
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
      ${section('Mă uit acum', watching.length ? `<div class="row-scroll">${watching.map((t) => poster(t, { href: titleHref(t) })).join('')}</div>` : empty('Nimic în curs acum.'), R('/seriale?status=watching'))}
      ${section('Activitate recentă', recent.length ? `<div class="row-scroll">${recent.join('')}</div>` : empty('Încă nu e nimic aici.'), R('/jurnal'))}
      ${reviews.length ? section('Recenzii recente', reviews.map((r) => reviewItem(r)).join(''), R('/recenzii')) : ''}
      ${lists.length ? section('Liste', `<div class="list-cards">${lists.map(listCard).join('')}</div>`, R('/liste')) : ''}
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
    const route = type === 'tv' ? R('/seriale') : R('/filme');
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
        <a class="see-all" href="${R('/liste')}">‹ Toate listele</a>
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
      ? `<div class="card"><h3>Apare în liste</h3>${inLists.map((l) => `<a href="${R('/lista/' + l.id)}" style="display:block;padding:4px 0;color:var(--accent-text)">${esc(l.name)}</a>`).join('')}</div>` : '';

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

  // ---------- prieteni = conturile pe care le urmaresti ----------

  const userCache = new Map();
  function loadFollowed(uid) {
    if (!userCache.has(uid)) userCache.set(uid, backend.loadUserByUid(uid).catch(() => null));
    return userCache.get(uid);
  }
  const userHome = (d) => BASE + d.profile.username;
  const userTitleHref = (d, t) => `${userHome(d)}/${t.type === 'movie' ? 'film' : 'serial'}/${slug(t.title) || 'titlu'}-${t.id}`;
  const userAvatar = (d, size = '') => (d.profile.avatar
    ? `<img class="avatar ${size}" src="${esc(d.profile.avatar)}" alt="" loading="lazy">`
    : `<div class="avatar ${size}" style="${d.profile.accent ? `color:${esc(d.profile.accent)}` : ''}">${esc((d.profile.name || d.profile.username || '?').charAt(0).toUpperCase())}</div>`);

  function friendsSidebarCard() {
    const following = DB.profile.following || [];
    if (!following.length) return '';
    return `<div class="card"><h3>Prieteni · ${following.length}</h3><div class="friend-dots" id="friend-dots">${following.map(() => '<div class="avatar sm"></div>').join('')}</div>
      <a class="see-all" style="display:inline-block;margin-top:12px" href="${R('/prieteni')}">Vezi prietenii ›</a></div>`;
  }

  async function fillFriendsSidebar() {
    const box = document.getElementById('friend-dots');
    if (!box) return;
    const list = (await Promise.all((DB.profile.following || []).map(loadFollowed))).filter((d) => d && d.profile.username);
    if (!box.isConnected) return;
    box.innerHTML = list.map((d) => `<a href="${esc(userHome(d))}" title="${esc(d.profile.name)}">${userAvatar(d, 'sm')}</a>`).join('');
  }

  function pageFriends() {
    const following = DB.profile.following || [];
    if (!following.length) return shell('prieteni', empty('Nu urmărește pe nimeni încă.'));
    return shell('prieteni', `<div class="friend-cards" id="friend-cards">${following.map(() => '<div class="card friend-card skeleton"></div>').join('')}</div>
      <div id="friend-feed"></div>`);
  }

  async function fillFriendsPage() {
    const cards = document.getElementById('friend-cards');
    if (!cards) return;
    const list = (await Promise.all((DB.profile.following || []).map(loadFollowed))).filter((d) => d && d.profile.username);
    if (!cards.isConnected) return;
    cards.innerHTML = list.map((d) => {
      if (d.private) {
        return `<a class="card friend-card" href="${esc(userHome(d))}">${userAvatar(d)}<div><b>${esc(d.profile.name || d.profile.username)}</b><span class="muted">🔒 Profil privat</span></div></a>`;
      }
      const tv = d.titles.filter((t) => t.type === 'tv').length;
      const mv = d.titles.filter((t) => t.type === 'movie').length;
      return `<a class="card friend-card" href="${esc(userHome(d))}" style="--friend:${esc(d.profile.accent || 'var(--accent)')}">
        ${userAvatar(d)}
        <div style="min-width:0"><b>${esc(d.profile.name)}</b>
          <span class="muted">@${esc(d.profile.username)} · ${tv} seriale · ${mv} filme · ${d.diary.length} în jurnal</span></div>
        <span class="arrow">›</span></a>`;
    }).join('') || empty('Conturile urmărite nu mai există.');

    // activitatea recenta a prietenilor, amestecata, cea mai noua prima
    const feed = [];
    for (const d of list) {
      if (d.private) continue;
      const titles = new Map(d.titles.map((t) => [t.id, t]));
      for (const e of d.diary) {
        const t = titles.get(e.titleId);
        if (t) feed.push({ d, e, t });
      }
    }
    feed.sort((a, b) => (b.e.date + (b.e.createdAt || '')).localeCompare(a.e.date + (a.e.createdAt || '')));
    const box = document.getElementById('friend-feed');
    if (!box || !feed.length) return;
    box.innerHTML = section('Activitatea prietenilor', `<div class="diary-box">${feed.slice(0, 30).map(({ d, e, t }) => `
      <a class="diary-row" href="${esc(userTitleHref(d, t))}">
        <div class="diary-day">${userAvatar(d, 'xs')}</div>
        <div class="thumb">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}</div>
        <div style="min-width:0"><div class="diary-title">${esc(t.title)}</div>
          <div class="diary-sub">${esc(d.profile.name)} · ${esc(scopeLabel(e, t))} · ${fmtDate(e.date)}</div></div>
        <div class="diary-flags">${e.rewatch ? '<span title="Revăzut">↻</span>' : ''}${e.review ? '<span title="Are recenzie">≡</span>' : ''}${stars(e.rating, 'accent')}${heart(e.liked)}</div>
      </a>`).join('')}</div>`);
  }

  // butonul Urmareste / Editeaza profilul de langa nume
  async function fillFollowButton() {
    const slot = document.getElementById('follow-slot');
    if (!slot || !backend.user) return;
    if (backend.user.uid === DB.uid) {
      slot.innerHTML = '<a class="btn small" href="admin.html">✎ Editează profilul</a>';
      return;
    }
    let me;
    try { me = await api('/api/public'); } catch { return; }
    if (!slot.isConnected) return;
    const draw = () => {
      const on = (me.profile.following || []).includes(DB.uid);
      slot.innerHTML = `<button class="btn small ${on ? '' : 'primary'}" id="follow-btn">${on ? '✓ Urmărești' : '+ Urmărește'}</button>`;
      slot.querySelector('#follow-btn').addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        const following = on ? me.profile.following.filter((x) => x !== DB.uid) : [...(me.profile.following || []), DB.uid];
        try { me.profile = await api('/api/profile', { method: 'PUT', body: { following } }); } catch (e) { alert(e.message); }
        draw();
      });
    };
    draw();
  }

  // ---------- antet: cont ----------

  async function renderAuthSlot() {
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    if (!backend || !backend.user) {
      slot.innerHTML = '<a class="btn small ghost" href="admin.html">Intră</a><a class="btn small primary" href="admin.html#cont-nou">Creează cont</a>';
      return;
    }
    let username = '';
    try { username = await backend.myUsername(); } catch { /* profil inexistent */ }
    slot.innerHTML = `${username ? `<a class="btn small ghost" href="${BASE}${esc(username)}">Profilul meu</a>` : ''}<a class="btn small" href="admin.html">⚙ Setări</a>`;
  }

  // ---------- pagina principala ----------

  const FEATURES = [
    ['▤', 'Jurnal', 'Notează fiecare episod și film văzut, cu dată, notă și ♥. Totul ordonat pe luni.'],
    ['★', 'Note și recenzii', 'Stele cu jumătăți, recenzii cu spoilere ascunse și note pe fiecare sezon.'],
    ['☰', 'Liste', 'Topuri, colecții, „de văzut în weekend” — liste numerotate sau simple.'],
    ['☺', 'Prieteni', 'Urmărește-ți prietenii și vezi ce au văzut și cât de mult le-a plăcut.'],
  ];

  function pageHome() {
    const logged = backend.user;
    const cta = logged
      ? '<a class="btn primary" href="admin.html">＋ Adaugă seriale</a><a class="btn" id="home-my" href="./">Profilul meu</a>'
      : '<a class="btn primary" href="admin.html#cont-nou">Creează cont gratuit</a><a class="btn" href="admin.html">Am deja cont</a>';
    return `<section class="home-hero">
        <div class="container home-hero-grid">
          <div class="home-copy">
            <span class="home-kicker">${WL.logoSvg(null, { size: 22, id: 'hk' })} EDITSEL</span>
            <h1>Tot ce vezi.<br><span>Într-un singur loc.</span></h1>
            <p>Jurnalul tău de seriale și filme: dă note, scrie recenzii, fă-ți liste și vezi ce urmăresc prietenii tăi.</p>
            <div class="home-cta">${cta}</div>
            <div class="home-stats" id="home-stats"></div>
          </div>
          <div class="poster-wall" id="poster-wall" aria-hidden="true">
            ${Array.from({ length: 12 }, (_, i) => `<div class="pw-card" style="--i:${i}"></div>`).join('')}
          </div>
        </div>
      </section>

      <div class="container page home-page">
        <section class="home-features">
          ${FEATURES.map(([ic, t, d]) => `<div class="feature"><span class="feature-ic">${ic}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
        </section>

        <div class="home-columns">
          <section class="section">
            <div class="section-head"><h2>Activitate recentă</h2></div>
            <div id="home-feed"><div class="diary-box">${Array.from({ length: 4 }, () => '<div class="diary-row skeleton-row"></div>').join('')}</div></div>
          </section>
          <section class="section">
            <div class="section-head"><h2>Membri</h2></div>
            <div class="member-list" id="members">${Array.from({ length: 3 }, () => '<div class="card friend-card skeleton"></div>').join('')}</div>
          </section>
        </div>

        ${logged ? '' : `<section class="home-final">
          <h2>Începe-ți jurnalul azi.</h2>
          <p>Gratuit, fără reclame. Durează un minut.</p>
          <a class="btn primary" href="admin.html#cont-nou">Creează cont</a>
        </section>`}
      </div>`;
  }

  async function fillHome() {
    if (backend.user) backend.myUsername().then((u) => { const a = document.getElementById('home-my'); if (a && u) a.href = BASE + u; }).catch(() => {});
    let data = { members: [], active: [] };
    try { data = await backend.loadCommunity(8); } catch (e) { console.error(e); }
    if (!document.getElementById('members')) return;

    // peretele de postere: din bibliotecile membrilor activi
    const posters = [...new Set(data.active.flatMap((d) => d.titles.map((t) => t.poster).filter((p) => p && /^https?:/.test(p))))]
      .sort(() => Math.random() - 0.5).slice(0, 12);
    const wall = document.getElementById('poster-wall');
    if (wall && posters.length) {
      wall.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const src = posters[i % posters.length];
        return `<div class="pw-card" style="--i:${i}"><img src="${esc(src)}" alt="" loading="lazy"></div>`;
      }).join('');
    }

    const titlesCount = data.active.reduce((n, d) => n + d.titles.length, 0);
    const diaryCount = data.active.reduce((n, d) => n + d.diary.length, 0);
    const stats = document.getElementById('home-stats');
    if (stats && data.members.length) {
      stats.innerHTML = `<div><b>${data.members.length}</b><span>${data.members.length === 1 ? 'membru' : 'membri'}</span></div>
        <div><b>${titlesCount}</b><span>titluri</span></div><div><b>${diaryCount}</b><span>în jurnale</span></div>`;
    }

    // activitatea recenta din toate jurnalele
    const feed = [];
    for (const d of data.active) {
      const titles = new Map(d.titles.map((t) => [t.id, t]));
      for (const e of d.diary) { const t = titles.get(e.titleId); if (t) feed.push({ d, e, t }); }
    }
    feed.sort((a, b) => (b.e.date + (b.e.createdAt || '')).localeCompare(a.e.date + (a.e.createdAt || '')));
    const feedBox = document.getElementById('home-feed');
    if (feedBox) {
      feedBox.innerHTML = feed.length ? `<div class="diary-box">${feed.slice(0, 10).map(({ d, e, t }) => `
        <a class="diary-row" href="${esc(userTitleHref(d, t))}">
          <div class="diary-day">${userAvatar(d, 'xs')}</div>
          <div class="thumb">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}</div>
          <div style="min-width:0"><div class="diary-title">${esc(t.title)}</div>
            <div class="diary-sub">${esc(d.profile.name)} · ${esc(scopeLabel(e, t))} · ${fmtDate(e.date)}</div></div>
          <div class="diary-flags">${stars(e.rating, 'accent')}${heart(e.liked)}</div>
        </a>`).join('')}</div>` : empty('Încă nu e nicio activitate. Fii primul care notează ce a văzut!');
    }

    const counts = new Map(data.active.map((d) => [d.uid, d]));
    document.getElementById('members').innerHTML = data.members.filter((p) => p.username).map((p) => {
      const d = counts.get(p.uid);
      const sub = d ? `${d.titles.filter((t) => t.type === 'tv').length} seriale · ${d.titles.filter((t) => t.type === 'movie').length} filme` : (p.bio ? esc(p.bio.slice(0, 50)) : 'membru nou');
      return `<a class="member-card" href="${BASE}${esc(p.username)}" style="--friend:${esc(p.accent || 'var(--accent)')}">
        <div class="member-banner" style="${p.banner && /^https?:|^data:/.test(p.banner) ? `background-image:url('${esc(p.banner)}')` : ''}"></div>
        <div class="member-body">
          ${p.avatar ? `<img class="avatar" src="${esc(p.avatar)}" alt="" loading="lazy">` : `<div class="avatar" style="color:${esc(p.accent || 'var(--accent)')}">${esc((p.name || p.username).charAt(0).toUpperCase())}</div>`}
          <div style="min-width:0"><b>${esc(p.name || p.username)}</b><span class="muted">@${esc(p.username)} · ${sub}</span></div>
        </div>
      </a>`;
    }).join('') || empty('Încă nu s-a înscris nimeni. Fii primul!');
  }

  // ---------- router ----------

  let backend = null;
  let loadedUser = null;
  let renderToken = 0;

  function navigate(url, replace = false) {
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    render();
  }

  const titleId = (seg) => String(seg || '').split('-').pop();

  function done() {
    document.body.classList.remove('loading');
  }

  async function render() {
    const token = ++renderToken;
    const rel = decodeURIComponent(location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname.slice(1));
    const parts = rel.split('/').filter(Boolean);

    if (!parts.length) {
      applyAccent(WL.COLORS[0][1]);
      app.innerHTML = pageHome();
      document.title = 'EDITSEL · Jurnal de seriale și filme';
      done();
      window.scrollTo(0, 0);
      fillHome();
      return;
    }

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
      case 'seriale': html = pageLibrary('tv', q); title += ' · Seriale'; break;
      case 'filme': html = pageLibrary('movie', q); title += ' · Filme'; break;
      case 'recenzii': html = pageReviews(); title += ' · Recenzii'; break;
      case 'aprecieri': html = pageLikes(); title += ' · Aprecieri'; break;
      case 'jurnal': html = pageDiary(q); title += ' · Jurnal'; break;
      case 'liste': html = pageLists(); title += ' · Liste'; break;
      case 'lista': html = pageList(parts[1]); title += ' · Listă'; break;
      case 'prieteni': html = pageFriends(); title += ' · Prieteni'; break;
      case 'statistici': html = DB.profile.showStats === false ? pageProfile() : pageStats(); title += ' · Statistici'; break;
      case 'serial':
      case 'film': {
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
    if (parts[0] === 'prieteni') fillFriendsPage();
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
    if (ev.target.id === 'diary-filter') navigate(R(`/jurnal?tip=${ev.target.value}`));
  });
  app.addEventListener('click', (ev) => {
    const sp = ev.target.closest('.spoiler');
    if (sp && ev.target.closest('.text')) sp.classList.add('revealed');
  });

  // popup unic despre API-ul TMDB (se tine minte in browser dupa „Am inteles”)
  document.getElementById('year').textContent = new Date().getFullYear();
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
    b.onAuth(() => { renderAuthSlot(); loadedUser = null; userCache.clear(); render(); });
    render();
  });
})();
