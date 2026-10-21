// Panou admin: adaugi / modifici seriale, filme, jurnal, liste si profilul.
(function () {
  const { esc, STATUS, fmtDate, stars, heart, poster, api } = WL;
  const root = document.getElementById('root');
  const logoutBtn = document.getElementById('logout');
  const profileLink = document.getElementById('profile-link');

  let DB = null;
  let STATE = { hasTmdb: false };
  let section = localStorage.getItem('wl_admin_section') || 'add';
  // data de azi in ora locala (toISOString ar da ziua din UTC, adica ieri dupa miezul noptii)
  const today = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------- utilitare UI ----------

  function toast(msg, err = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), err ? 4500 : 2200);
  }

  async function run(fn, okMsg) {
    try {
      const r = await fn();
      if (okMsg) toast(okMsg);
      return r;
    } catch (e) {
      if (e.status === 401) { boot(); }
      toast(e.message, true);
      throw e;
    }
  }

  async function reload() {
    DB = await api('/api/public');
  }

  function openModal(html) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog">${html}</div>`;
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    function close() { back.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; }
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    return { el: back.querySelector('.modal'), close };
  }

  // Stele cu jumatati: click pe jumatatea stanga = x.5, click pe aceeasi valoare = sterge.
  function starInput(container, value, onChange, small = false) {
    let v = value || 0;
    container.innerHTML = `<span class="star-input ${small ? 'sm' : ''}">${'<span class="s">★</span>'.repeat(5)}<span class="val"></span></span>`;
    const wrap = container.firstElementChild;
    const starsEls = [...wrap.querySelectorAll('.s')];
    const valEl = wrap.querySelector('.val');
    const paint = (x) => {
      starsEls.forEach((s, i) => { s.className = 's ' + (x >= i + 1 ? 'full' : x >= i + 0.5 ? 'half' : ''); });
      valEl.textContent = x ? x.toFixed(1) : '—';
    };
    const valueAt = (e) => {
      const s = e.target.closest('.s');
      if (!s) return null;
      const i = starsEls.indexOf(s);
      const r = s.getBoundingClientRect();
      return i + ((e.clientX - r.left) < r.width / 2 ? 0.5 : 1);
    };
    wrap.addEventListener('mousemove', (e) => { const x = valueAt(e); if (x) paint(x); });
    wrap.addEventListener('mouseleave', () => paint(v));
    wrap.addEventListener('click', (e) => {
      const x = valueAt(e);
      if (!x) return;
      v = x === v ? 0 : x;
      paint(v);
      onChange(v);
    });
    paint(v);
  }

  async function fileToDataUrl(file, maxSize = 1600) {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = URL.createObjectURL(file);
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }

  async function uploadImage(file, maxSize) {
    const dataUrl = await fileToDataUrl(file, maxSize);
    const { url } = await api('/api/upload', { method: 'POST', body: { dataUrl } });
    return url;
  }

  const thumb = (t) => `<div class="thumb">${t && t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : ''}</div>`;

  // ---------- autentificare ----------

  async function boot() {
    const b = await WL.backend();
    if (!b || !b.api) {
      root.innerHTML = `<div class="auth-box card"><h2>Site-ul nu e conectat încă</h2><p class="muted">${b && b.missingConfig ? 'Lipsește configurarea Firebase (firebase-config.js).' : 'Nu am putut porni conexiunea cu baza de date.'}</p></div>`;
      return;
    }
    STATE = await api('/api/admin/status');
    if (!STATE.authed) {
      logoutBtn.classList.add('hidden');
      profileLink.classList.add('hidden');
      return renderAuth(location.hash === '#cont-nou' || /\/signup$/.test(location.pathname) ? 'register' : 'login');
    }
    logoutBtn.classList.remove('hidden');
    if (/\/(login|signup|admin(\.html)?)$/.test(location.pathname) || location.hash === '#cont-nou') history.replaceState(null, '', 'settings' + location.search);
    try { await reload(); } catch (e) {
      root.innerHTML = `<div class="auth-box card"><h2>Profilul nu a putut fi încărcat</h2><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    profileLink.href = DB.profile.username;
    profileLink.classList.remove('hidden');
    WL.applyAccent(DB.profile.accent);
    renderShell();
    openFromLink();
  }

  // settings?adauga=tv:1405 (din cautarea de pe site): deschide direct fereastra titlului
  async function openFromLink() {
    const params = new URLSearchParams(location.search);
    const m = /^(tv|movie):(\d+)$/.exec(params.get('adauga') || '');
    if (!m) return;
    history.replaceState(null, '', location.pathname);
    const existing = DB.titles.find((t) => t.type === m[1] && t.tmdbId === Number(m[2]));
    if (existing) return openTitleEditor(existing);
    try {
      const details = await run(() => api(`/api/tmdb/details?type=${m[1]}&id=${m[2]}`));
      openTitleEditor(null, details);
    } catch { /* eroarea e afisata de run() */ }
  }

  function renderAuth(mode) {
    const reg = mode === 'register';
    document.title = (reg ? 'Creează cont' : 'Intră în cont') + ' · EDITSEL';
    root.innerHTML = `<div class="auth-box card">
      <div style="display:flex;justify-content:center;margin-bottom:14px">${WL.logoSvg(null, { size: 54, id: 'al' })}</div>
      <h2 style="margin-bottom:6px;text-align:center">${reg ? 'Creează cont' : 'Intră în cont'}</h2>
      <p class="muted" style="margin:0 0 18px;font-size:14px;text-align:center">${reg ? 'Gratuit. Primești profilul tău de seriale și filme.' : 'Bine ai revenit!'}</p>
      <form id="auth">
        ${reg ? `<div class="field"><label>Nume afișat</label><input class="input" name="name" required maxlength="100" placeholder="ex: Ionuț"></div>
        <div class="field"><label>Username (apare în link: site/<b>username</b>)</label><input class="input" name="username" required pattern="[a-zA-Z0-9._\\-]{3,30}" placeholder="ex: ionutzz" autocomplete="username"></div>` : ''}
        <div class="field"><label>Email</label><input class="input" type="email" name="email" required autocomplete="email"></div>
        <div class="field"><label>Parolă</label><input class="input" type="password" name="password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}"></div>
        <button class="btn primary" style="width:100%">${reg ? 'Creează cont' : 'Intră'}</button>
      </form>
      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:16px;font-size:14px">
        <a href="#" id="auth-switch" style="color:var(--accent-text)">${reg ? 'Am deja cont' : 'Creează cont nou'}</a>
        ${reg ? '' : '<a href="#" id="auth-reset" class="muted">Am uitat parola</a>'}
      </div>
    </div>`;
    const f = root.querySelector('#auth');
    (reg ? f.name : f.email).focus();
    root.querySelector('#auth-switch').addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', reg ? 'login' : 'signup');
      renderAuth(reg ? 'login' : 'register');
    });
    const reset = root.querySelector('#auth-reset');
    if (reset) reset.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = f.email.value.trim() || prompt('Emailul contului:');
      if (!email) return;
      const b = await WL.backend();
      await run(() => b.resetPassword(email), 'Ți-am trimis pe email un link pentru parolă nouă.');
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button');
      btn.disabled = true;
      const b = await WL.backend();
      try {
        if (reg) await run(() => b.register({ email: f.email.value.trim(), password: f.password.value, username: f.username.value.trim().toLowerCase(), name: f.name.value.trim() }), 'Cont creat. Bun venit!');
        else await run(() => b.login(f.email.value.trim(), f.password.value));
        history.replaceState(null, '', location.pathname);
        section = reg ? 'add' : section;
        boot();
      } catch { btn.disabled = false; }
    });
  }

  logoutBtn.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    DB = null;
    boot();
  });

  // ---------- schelet ----------

  const SECTIONS = [
    ['add', '＋', 'Adaugă'],
    ['library', '▦', 'Bibliotecă'],
    ['diary', '▤', 'Jurnal'],
    ['lists', '☰', 'Liste'],
    ['settings', '⚙', 'Setări'],
  ];

  function renderShell() {
    root.innerHTML = `<div class="admin-layout">
      <nav class="admin-nav">${SECTIONS.map(([k, ic, label]) => `<button data-s="${k}" class="${k === section ? 'active' : ''}"><span class="ic">${ic}</span>${label}</button>`).join('')}</nav>
      <div id="panel"></div>
    </div>`;
    root.querySelector('.admin-nav').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      section = b.dataset.s;
      localStorage.setItem('wl_admin_section', section);
      root.querySelectorAll('.admin-nav button').forEach((x) => x.classList.toggle('active', x === b));
      renderPanel();
    });
    renderPanel();
  }

  function renderPanel() {
    const panel = document.getElementById('panel');
    if (!panel) return;
    panel.onclick = null;
    ({ add: panelAdd, library: panelLibrary, diary: panelDiary, lists: panelLists, settings: panelSettings }[section] || panelAdd)(panel);
  }

  // ---------- Adauga ----------

  let searchType = 'multi';
  let lastQuery = '';

  function panelAdd(panel) {
    panel.innerHTML = `
      <div class="panel-title">Adaugă serial sau film<span class="grow"></span><button class="btn small" id="manual">Adaugă manual</button></div>
      ${STATE.hasTmdb ? '' : STATE.isSiteAdmin ? `<div class="box">Pentru căutare automată (postere, descrieri, sezoane, actori) site-ul are nevoie de o cheie TMDB gratuită. Pune-o în <a href="#" id="go-settings" style="color:var(--accent-text)">Setări → TMDB</a>. Până atunci poți adăuga manual.</div>` : `<div class="box">Căutarea automată nu e pornită încă pe site (administratorul trebuie să pună cheia TMDB). Până atunci poți adăuga manual.</div>`}
      <div class="toolbar">
        <div class="seg" id="stype">
          <button data-t="multi" class="${searchType === 'multi' ? 'on' : ''}">Toate</button>
          <button data-t="tv" class="${searchType === 'tv' ? 'on' : ''}">Seriale</button>
          <button data-t="movie" class="${searchType === 'movie' ? 'on' : ''}">Filme</button>
        </div>
        <input class="input" id="q" style="flex:1" placeholder="Caută un titlu… (ex: Dexter)" value="${esc(lastQuery)}" ${STATE.hasTmdb ? '' : 'disabled'}>
      </div>
      <div id="results" class="results"></div>`;

    const q = panel.querySelector('#q');
    const results = panel.querySelector('#results');
    let timer;
    const doSearch = async () => {
      lastQuery = q.value.trim();
      if (!lastQuery) { results.innerHTML = ''; return; }
      results.innerHTML = '<div class="muted">Caut…</div>';
      try {
        const list = await api(`/api/tmdb/search?type=${searchType}&q=${encodeURIComponent(lastQuery)}`);
        if (!list.length) { results.innerHTML = '<div class="muted">Nimic găsit.</div>'; return; }
        results.innerHTML = list.map((r, i) => {
          const existing = DB.titles.find((t) => t.tmdbId === r.tmdbId && t.type === r.type);
          return `<button class="result" data-i="${i}">
            <div class="poster-img">${existing ? '<span class="in-lib">În bibliotecă</span>' : ''}${r.poster ? `<img src="${esc(r.poster)}" alt="" loading="lazy">` : `<div class="poster-fallback"><span>${esc(r.title)}</span></div>`}</div>
            <div class="t">${esc(r.title)}</div>
            <div class="y">${esc(r.year || '—')} · ${r.type === 'tv' ? 'Serial' : 'Film'}</div>
          </button>`;
        }).join('');
        results.onclick = async (e) => {
          const b = e.target.closest('.result');
          if (!b) return;
          const r = list[Number(b.dataset.i)];
          const existing = DB.titles.find((t) => t.tmdbId === r.tmdbId && t.type === r.type);
          if (existing) return openTitleEditor(existing);
          b.style.opacity = '.5';
          try {
            const details = await run(() => api(`/api/tmdb/details?type=${r.type}&id=${r.tmdbId}`));
            openTitleEditor(null, details);
          } finally { b.style.opacity = ''; }
        };
      } catch (err) {
        results.innerHTML = `<div class="muted">${esc(err.message)}</div>`;
      }
    };
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 350); });
    panel.querySelector('#stype').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      searchType = b.dataset.t;
      panel.querySelectorAll('#stype button').forEach((x) => x.classList.toggle('on', x === b));
      doSearch();
    });
    panel.querySelector('#manual').addEventListener('click', () => openTitleEditor(null, { type: searchType === 'movie' ? 'movie' : 'tv', title: '' }));
    const gs = panel.querySelector('#go-settings');
    if (gs) gs.addEventListener('click', (e) => { e.preventDefault(); settingsPage = 'tmdb'; root.querySelector('[data-s="settings"]').click(); });
    if (lastQuery && STATE.hasTmdb) doSearch();
    if (STATE.hasTmdb) q.focus();
  }

  // ---------- Editor titlu ----------

  function openTitleEditor(existing, fresh) {
    const isNew = !existing;
    const d = isNew
      ? { status: 'watched', rating: 0, liked: false, favorite: false, review: '', spoiler: false, episodesWatched: 0, seasonRatings: {}, note: '', genres: [], ...fresh }
      : JSON.parse(JSON.stringify(existing));
    d.seasonRatings = d.seasonRatings || {};
    const manual = !d.tmdbId;
    const log = { on: isNew, date: today(), season: '', episode: '', rewatch: false };

    const { el, close } = openModal(`
      <div class="modal-head">
        <div id="m-poster">${poster(d, { showMeta: false })}</div>
        <div style="min-width:0">
          <h2 id="m-title" class="notranslate">${esc(d.title || 'Titlu nou')}</h2>
          <div class="muted" style="font-size:14px" id="m-sub"></div>
        </div>
      </div>
      <div class="modal-body">
        <div class="field"><span class="lbl">Status</span>
          <div class="seg" id="m-status">${Object.entries(STATUS).map(([k, s]) => `<button type="button" data-v="${k}" class="${d.status === k ? 'on' : ''}">${s.icon} ${s.label}</button>`).join('')}</div>
        </div>
        <div class="row-fields">
          <div class="field"><span class="lbl">Rating</span><div id="m-rating"></div></div>
          <div class="field"><span class="lbl">Marcaje</span>
            <div style="display:flex;gap:8px">
              <button type="button" class="toggle like ${d.liked ? 'on' : ''}" id="m-like">♥ Îmi place</button>
              <button type="button" class="toggle fav ${d.favorite ? 'on' : ''}" id="m-fav">★ Favorit</button>
            </div>
          </div>
        </div>
        <div class="field tv-only"><span class="lbl">Episoade văzute</span>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="input" type="number" min="0" id="m-eps" style="width:110px" value="${d.episodesWatched || 0}">
            <span class="muted" id="m-eps-total"></span>
            <button type="button" class="btn small" id="m-eps-all">Toate</button>
          </div>
          <span class="hint">Folosit pentru timpul petrecut. La status „Văzut” cu 0, se socotesc toate episoadele.</span>
        </div>
        <div class="field"><label for="m-review">Recenzie</label>
          <textarea class="textarea" id="m-review" placeholder="Ce părere ai?">${esc(d.review || '')}</textarea>
          <label class="check"><input type="checkbox" id="m-spoiler" ${d.spoiler ? 'checked' : ''}> Conține spoilere (se afișează blurat)</label>
        </div>
        <div class="field tv-only" id="m-seasons-wrap"><span class="lbl">Note pe sezoane</span><div id="m-seasons" class="box" style="margin:0"></div></div>

        <div class="box">
          <label class="check"><input type="checkbox" id="m-log" ${log.on ? 'checked' : ''}> <b>Adaugă în jurnal</b> <span class="muted">(cu ratingul și ♥ de mai sus)</span></label>
          <div id="m-log-fields" class="row-fields" style="margin-top:12px">
            <div class="field"><label>Data</label><input class="input" type="date" id="m-log-date" value="${log.date}"></div>
            <div class="field tv-only"><label>Sezon (opțional)</label><input class="input" type="number" min="0" id="m-log-s"></div>
            <div class="field tv-only"><label>Episod (opțional)</label><input class="input" type="number" min="0" id="m-log-e"></div>
            <div class="field" style="justify-content:flex-end"><label class="check"><input type="checkbox" id="m-log-rw"> Revăzut</label></div>
          </div>
        </div>

        <details ${manual ? 'open' : ''}>
          <summary>Detalii titlu ${manual ? '' : '(de la TMDB, le poți modifica)'}</summary>
          <div class="row-fields">
            <div class="field"><label>Tip</label><select id="f-type"><option value="tv" ${d.type === 'tv' ? 'selected' : ''}>Serial</option><option value="movie" ${d.type === 'movie' ? 'selected' : ''}>Film</option></select></div>
            <div class="field" style="grid-column:span 2"><label>Titlu</label><input class="input" id="f-title" value="${esc(d.title || '')}"></div>
            <div class="field"><label>An</label><input class="input" id="f-year" maxlength="4" value="${esc(d.year || '')}"></div>
          </div>
          <div class="row-fields">
            <div class="field"><label id="f-runtime-lbl">Durată (min)</label><input class="input" type="number" min="0" id="f-runtime" value="${d.runtime || ''}"></div>
            <div class="field tv-only"><label>Nr. sezoane</label><input class="input" type="number" min="0" id="f-seasons" value="${d.seasonsCount || ''}"></div>
            <div class="field tv-only"><label>Nr. episoade</label><input class="input" type="number" min="0" id="f-episodes" value="${d.episodesCount || ''}"></div>
          </div>
          <div class="field"><label>Genuri (separate prin virgulă)</label><input class="input" id="f-genres" value="${esc((d.genres || []).join(', '))}"></div>
          <div class="field"><label>Poster (URL)</label><div style="display:flex;gap:8px"><input class="input" id="f-poster" value="${esc(d.poster || '')}">${d.tmdbId ? `<button type="button" class="btn small" style="height:38px" data-pick="poster">Alege</button>` : ''}<label class="btn small" style="height:38px">Încarcă<input type="file" accept="image/*" id="f-poster-file" hidden></label></div></div>
          <div class="field"><label>Imagine fundal (URL)</label><div style="display:flex;gap:8px"><input class="input" id="f-backdrop" value="${esc(d.backdrop || '')}">${d.tmdbId ? `<button type="button" class="btn small" style="height:38px" data-pick="backdrop">Alege</button>` : ''}<label class="btn small" style="height:38px">Încarcă<input type="file" accept="image/*" id="f-backdrop-file" hidden></label></div></div>
          <div class="field"><label>Tagline</label><input class="input" id="f-tagline" value="${esc(d.tagline || '')}"></div>
          <div class="field"><label>Descriere</label><textarea class="textarea" id="f-overview">${esc(d.overview || '')}</textarea></div>
          <div class="field"><label>Notiță (apare pe pagina titlului)</label><textarea class="textarea" id="f-note" style="min-height:70px">${esc(d.note || '')}</textarea></div>
        </details>
      </div>
      <div class="modal-foot">
        ${isNew ? '' : '<button class="btn danger" id="m-del">Șterge</button>'}
        ${!isNew && d.tmdbId && STATE.hasTmdb ? '<button class="btn" id="m-refresh" title="Actualizează posterul, sezoanele, actorii etc.">↻ Actualizează din TMDB</button>' : ''}
        <span class="grow"></span>
        <button class="btn ghost" id="m-cancel">Anulează</button>
        <button class="btn primary" id="m-save">${isNew ? 'Adaugă' : 'Salvează'}</button>
      </div>`);

    const $ = (s) => el.querySelector(s);

    function refreshTypeUi() {
      const type = $('#f-type').value;
      el.querySelectorAll('.tv-only').forEach((x) => x.classList.toggle('hidden', type !== 'tv'));
      $('#f-runtime-lbl').textContent = type === 'tv' ? 'Durată episod (min)' : 'Durată (min)';
      const total = Number($('#f-episodes').value) || 0;
      $('#m-eps-total').textContent = total ? `din ${total}` : '';
      $('#m-sub').textContent = [$('#f-year').value, type === 'tv' ? 'Serial' : 'Film', (d.genres || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ');
      $('#m-seasons-wrap').classList.toggle('hidden', type !== 'tv' || !(d.seasons || []).length);
    }

    starInput($('#m-rating'), d.rating, (v) => { d.rating = v; });

    const seasonsBox = $('#m-seasons');
    (d.seasons || []).forEach((s) => {
      const row = document.createElement('div');
      row.className = 'season-rate';
      row.innerHTML = `<span>${esc(s.name || 'Sezonul ' + s.number)} <span class="muted" style="font-size:12px">${s.episodes} ep.</span></span><span></span>`;
      starInput(row.lastElementChild, d.seasonRatings[String(s.number)] || 0, (v) => {
        if (v) d.seasonRatings[String(s.number)] = v; else delete d.seasonRatings[String(s.number)];
      }, true);
      seasonsBox.appendChild(row);
    });

    $('#m-status').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      d.status = b.dataset.v;
      el.querySelectorAll('#m-status button').forEach((x) => x.classList.toggle('on', x === b));
      if (isNew) { $('#m-log').checked = d.status !== 'watchlist'; syncLog(); }
    });
    $('#m-like').addEventListener('click', (e) => { d.liked = !d.liked; e.currentTarget.classList.toggle('on', d.liked); });
    $('#m-fav').addEventListener('click', (e) => { d.favorite = !d.favorite; e.currentTarget.classList.toggle('on', d.favorite); });
    $('#m-eps-all').addEventListener('click', () => { $('#m-eps').value = Number($('#f-episodes').value) || 0; });
    $('#f-type').addEventListener('change', refreshTypeUi);
    $('#f-episodes').addEventListener('input', refreshTypeUi);
    $('#f-year').addEventListener('input', refreshTypeUi);
    $('#f-title').addEventListener('input', () => { $('#m-title').textContent = $('#f-title').value || 'Titlu nou'; });
    const syncLog = () => $('#m-log-fields').classList.toggle('hidden', !$('#m-log').checked);
    $('#m-log').addEventListener('change', syncLog);
    for (const which of ['poster', 'backdrop']) {
      $(`#f-${which}-file`).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = await run(() => uploadImage(file, which === 'poster' ? 600 : 1280), 'Imagine încărcată');
        $(`#f-${which}`).value = url;
        if (which === 'poster') { d.poster = url; $('#m-poster').innerHTML = poster(d, { showMeta: false }); }
      });
    }
    el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const which = b.dataset.pick;
      openImagePicker({
        kind: which === 'poster' ? 'posters' : 'backdrops',
        heading: which === 'poster' ? 'Alege posterul' : 'Alege fundalul',
        initial: { type: $('#f-type').value, tmdbId: d.tmdbId, title: d.title },
        onPick: (url) => {
          $(`#f-${which}`).value = url;
          if (which === 'poster') { d.poster = url; $('#m-poster').innerHTML = poster(d, { showMeta: false }); }
          toast('Imagine aleasă, apasă Salvează');
        },
      });
    }));
    $('#m-cancel').addEventListener('click', close);
    syncLog();
    refreshTypeUi();

    if ($('#m-del')) {
      $('#m-del').addEventListener('click', async () => {
        if (!confirm(`Ștergi „${d.title}”? Se șterg și intrările din jurnal pentru el.`)) return;
        await run(() => api(`/api/titles/${d.id}`, { method: 'DELETE' }), 'Șters');
        close(); await reload(); renderPanel();
      });
    }
    if ($('#m-refresh')) {
      $('#m-refresh').addEventListener('click', async () => {
        const fresh2 = await run(() => api(`/api/tmdb/details?type=${d.type}&id=${d.tmdbId}`));
        await run(() => api(`/api/titles/${d.id}`, { method: 'PUT', body: fresh2 }), 'Actualizat din TMDB');
        close(); await reload(); renderPanel();
        openTitleEditor(DB.titles.find((t) => t.id === d.id));
      });
    }

    $('#m-save').addEventListener('click', async () => {
      const body = {
        ...d,
        type: $('#f-type').value,
        title: $('#f-title').value.trim(),
        year: $('#f-year').value.trim(),
        runtime: Number($('#f-runtime').value) || 0,
        seasonsCount: Number($('#f-seasons').value) || 0,
        episodesCount: Number($('#f-episodes').value) || 0,
        genres: $('#f-genres').value.split(',').map((g) => g.trim()).filter(Boolean),
        poster: $('#f-poster').value.trim(),
        backdrop: $('#f-backdrop').value.trim(),
        tagline: $('#f-tagline').value.trim(),
        overview: $('#f-overview').value.trim(),
        note: $('#f-note').value.trim(),
        episodesWatched: Number($('#m-eps').value) || 0,
        review: $('#m-review').value,
        spoiler: $('#m-spoiler').checked,
      };
      if (!body.title) return toast('Titlul e obligatoriu.', true);
      $('#m-save').disabled = true;
      try {
        const saved = isNew
          ? await run(() => api('/api/titles', { method: 'POST', body }))
          : await run(() => api(`/api/titles/${d.id}`, { method: 'PUT', body }));
        if ($('#m-log').checked) {
          await run(() => api('/api/diary', {
            method: 'POST',
            body: {
              titleId: saved.id,
              date: $('#m-log-date').value || today(),
              season: body.type === 'tv' ? $('#m-log-s').value : '',
              episode: body.type === 'tv' ? $('#m-log-e').value : '',
              rewatch: $('#m-log-rw').checked,
              rating: d.rating,
              liked: d.liked,
            },
          }));
        }
        toast(isNew ? `„${saved.title}” adăugat` : 'Salvat');
        close();
        await reload();
        renderPanel();
      } catch { $('#m-save').disabled = false; }
    });
  }

  // ---------- Biblioteca ----------

  let libFilter = { q: '', type: 'all', status: 'all' };

  function panelLibrary(panel) {
    panel.innerHTML = `
      <div class="panel-title">Bibliotecă <span class="muted" style="font-size:15px;font-weight:400">${DB.titles.length} titluri</span></div>
      <div class="toolbar">
        <input class="input" id="lq" placeholder="Filtrează…" value="${esc(libFilter.q)}" style="flex:1">
        <select id="lt"><option value="all">Toate tipurile</option><option value="tv">Seriale</option><option value="movie">Filme</option></select>
        <select id="ls"><option value="all">Toate statusurile</option>${Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr><th></th><th>Titlu</th><th class="hide-sm">Tip</th><th>Status</th><th>Rating</th><th class="hide-sm"></th><th></th></tr></thead><tbody id="lbody"></tbody></table></div>`;
    panel.querySelector('#lt').value = libFilter.type;
    panel.querySelector('#ls').value = libFilter.status;
    const body = panel.querySelector('#lbody');
    const draw = () => {
      const rows = DB.titles
        .filter((t) => (libFilter.type === 'all' || t.type === libFilter.type)
          && (libFilter.status === 'all' || t.status === libFilter.status)
          && norm(t.title).includes(norm(libFilter.q)))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      body.innerHTML = rows.length ? rows.map((t) => `<tr>
        <td style="width:52px">${thumb(t)}</td>
        <td><b>${esc(t.title)}</b> <span class="muted">${esc(t.year || '')}</span></td>
        <td class="hide-sm muted">${t.type === 'tv' ? 'Serial' : 'Film'}</td>
        <td><select data-status="${t.id}" style="min-width:130px">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></td>
        <td style="white-space:nowrap">${stars(t.rating, 'accent') || '<span class="muted">—</span>'}</td>
        <td class="hide-sm">${heart(t.liked)} ${t.favorite ? '<span style="color:#f0cf6c">★</span>' : ''}</td>
        <td class="actions"><button class="btn small" data-edit="${t.id}">Editează</button></td>
      </tr>`).join('') : `<tr><td colspan="7" class="muted" style="padding:20px;text-align:center">Nimic aici. Adaugă din secțiunea „Adaugă”.</td></tr>`;
    };
    draw();
    panel.querySelector('#lq').addEventListener('input', (e) => { libFilter.q = e.target.value; draw(); });
    panel.querySelector('#lt').addEventListener('change', (e) => { libFilter.type = e.target.value; draw(); });
    panel.querySelector('#ls').addEventListener('change', (e) => { libFilter.status = e.target.value; draw(); });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit]');
      if (b) openTitleEditor(DB.titles.find((t) => t.id === b.dataset.edit));
    });
    body.addEventListener('change', async (e) => {
      const s = e.target.closest('[data-status]');
      if (!s) return;
      const updated = await run(() => api(`/api/titles/${s.dataset.status}`, { method: 'PUT', body: { status: s.value } }), 'Status actualizat');
      const idx = DB.titles.findIndex((t) => t.id === updated.id);
      DB.titles[idx] = updated;
    });
  }

  // ---------- Jurnal ----------

  function panelDiary(panel) {
    const byId = new Map(DB.titles.map((t) => [t.id, t]));
    const entries = [...DB.diary].filter((e) => byId.has(e.titleId))
      .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
    panel.innerHTML = `
      <div class="panel-title">Jurnal <span class="muted" style="font-size:15px;font-weight:400">${entries.length} intrări</span><span class="grow"></span>
        <button class="btn primary small" id="d-new" ${DB.titles.length ? '' : 'disabled'}>＋ Intrare nouă</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th></th><th>Titlu</th><th>Rating</th><th class="hide-sm">Recenzie</th><th></th></tr></thead><tbody>
      ${entries.length ? entries.map((e) => {
        const t = byId.get(e.titleId);
        const scope = e.season != null && e.episode != null ? `S${e.season} E${e.episode}` : e.season != null ? `Sezonul ${e.season}` : '';
        return `<tr>
          <td style="white-space:nowrap">${fmtDate(e.date)}</td>
          <td style="width:52px">${thumb(t)}</td>
          <td><b>${esc(t.title)}</b> ${scope ? `<span class="badge">${scope}</span>` : ''} ${e.rewatch ? '<span class="badge">↻</span>' : ''}</td>
          <td style="white-space:nowrap">${stars(e.rating, 'accent')}${heart(e.liked)}</td>
          <td class="hide-sm muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.review || '')}</td>
          <td class="actions"><button class="btn small" data-edit="${e.id}">Editează</button></td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="muted" style="padding:20px;text-align:center">Jurnalul e gol.</td></tr>'}
      </tbody></table></div>`;
    panel.querySelector('#d-new').addEventListener('click', () => openDiaryEditor(null));
    panel.querySelector('tbody').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-edit]');
      if (b) openDiaryEditor(DB.diary.find((x) => x.id === b.dataset.edit));
    });
  }

  function openDiaryEditor(existing) {
    const isNew = !existing;
    const titles = [...DB.titles].sort((a, b) => a.title.localeCompare(b.title, 'ro'));
    const e = existing ? { ...existing } : { titleId: titles[0].id, date: today(), rating: 0, liked: false, rewatch: false, review: '', spoiler: false, season: null, episode: null };
    const { el, close } = openModal(`
      <div class="modal-head"><h2>${isNew ? 'Intrare nouă în jurnal' : 'Editează intrarea'}</h2></div>
      <div class="modal-body">
        <div class="field"><label>Titlu</label><select id="j-title">${titles.map((t) => `<option value="${t.id}" ${t.id === e.titleId ? 'selected' : ''}>${esc(t.title)} ${t.year ? '(' + esc(t.year) + ')' : ''} · ${t.type === 'tv' ? 'Serial' : 'Film'}</option>`).join('')}</select></div>
        <div class="row-fields">
          <div class="field"><label>Data</label><input class="input" type="date" id="j-date" value="${esc(e.date)}"></div>
          <div class="field j-tv"><label>Sezon</label><input class="input" type="number" min="0" id="j-s" value="${e.season ?? ''}"></div>
          <div class="field j-tv"><label>Episod</label><input class="input" type="number" min="0" id="j-e" value="${e.episode ?? ''}"></div>
        </div>
        <div class="row-fields">
          <div class="field"><span class="lbl">Rating</span><div id="j-rating"></div></div>
          <div class="field"><span class="lbl">Marcaje</span><div style="display:flex;gap:8px">
            <button type="button" class="toggle like ${e.liked ? 'on' : ''}" id="j-like">♥ Îmi place</button>
            <label class="check"><input type="checkbox" id="j-rw" ${e.rewatch ? 'checked' : ''}> Revăzut</label>
          </div></div>
        </div>
        <div class="field"><label>Recenzie (opțional)</label><textarea class="textarea" id="j-review">${esc(e.review || '')}</textarea>
          <label class="check"><input type="checkbox" id="j-spoiler" ${e.spoiler ? 'checked' : ''}> Conține spoilere</label></div>
      </div>
      <div class="modal-foot">
        ${isNew ? '' : '<button class="btn danger" id="j-del">Șterge</button>'}
        <span class="grow"></span>
        <button class="btn ghost" id="j-cancel">Anulează</button>
        <button class="btn primary" id="j-save">Salvează</button>
      </div>`);
    const $ = (s) => el.querySelector(s);
    const syncType = () => {
      const t = DB.titles.find((x) => x.id === $('#j-title').value);
      el.querySelectorAll('.j-tv').forEach((x) => x.classList.toggle('hidden', !t || t.type !== 'tv'));
    };
    $('#j-title').addEventListener('change', syncType);
    syncType();
    starInput($('#j-rating'), e.rating, (v) => { e.rating = v; });
    $('#j-like').addEventListener('click', (ev) => { e.liked = !e.liked; ev.currentTarget.classList.toggle('on', e.liked); });
    $('#j-cancel').addEventListener('click', close);
    if ($('#j-del')) $('#j-del').addEventListener('click', async () => {
      if (!confirm('Ștergi intrarea din jurnal?')) return;
      await run(() => api(`/api/diary/${e.id}`, { method: 'DELETE' }), 'Șters');
      close(); await reload(); renderPanel();
    });
    $('#j-save').addEventListener('click', async () => {
      const t = DB.titles.find((x) => x.id === $('#j-title').value);
      const body = {
        titleId: t.id,
        date: $('#j-date').value || today(),
        season: t.type === 'tv' ? $('#j-s').value : '',
        episode: t.type === 'tv' ? $('#j-e').value : '',
        rating: e.rating,
        liked: e.liked,
        rewatch: $('#j-rw').checked,
        review: $('#j-review').value,
        spoiler: $('#j-spoiler').checked,
      };
      await run(() => (isNew ? api('/api/diary', { method: 'POST', body }) : api(`/api/diary/${e.id}`, { method: 'PUT', body })), 'Salvat');
      close(); await reload(); renderPanel();
    });
  }

  // ---------- Liste ----------

  function panelLists(panel) {
    const byId = new Map(DB.titles.map((t) => [t.id, t]));
    panel.innerHTML = `
      <div class="panel-title">Liste<span class="grow"></span><button class="btn primary small" id="l-new">＋ Listă nouă</button></div>
      ${DB.lists.length ? `<div class="list-cards">${[...DB.lists].reverse().map((l) => `
        <button class="list-card" data-id="${l.id}" style="background:none;border:0;padding:0;text-align:left;cursor:pointer">
          <div class="stack">${l.items.map((i) => byId.get(i)).filter(Boolean).slice(0, 5).map((t) => `<div class="s">${t.poster ? `<img src="${esc(t.poster)}" alt="">` : ''}</div>`).join('') || '<div class="s"></div>'}</div>
          <h3>${esc(l.name)}</h3><p>${l.items.length} titluri</p>
        </button>`).join('')}</div>` : '<div class="empty-state">Nicio listă încă.</div>'}`;
    panel.querySelector('#l-new').addEventListener('click', () => openListEditor(null));
    panel.onclick = (e) => {
      const b = e.target.closest('.list-card');
      if (b) openListEditor(DB.lists.find((l) => l.id === b.dataset.id));
    };
  }

  function openListEditor(existing) {
    const isNew = !existing;
    const l = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', description: '', ranked: false, items: [] };
    const byId = new Map(DB.titles.map((t) => [t.id, t]));
    const { el, close } = openModal(`
      <div class="modal-head"><h2>${isNew ? 'Listă nouă' : 'Editează lista'}</h2></div>
      <div class="modal-body">
        <div class="field"><label>Nume</label><input class="input" id="l-name" value="${esc(l.name)}" placeholder="ex: Cele mai bune seriale crime"></div>
        <div class="field"><label>Descriere</label><textarea class="textarea" id="l-desc" style="min-height:70px">${esc(l.description)}</textarea></div>
        <label class="check" style="margin-bottom:14px"><input type="checkbox" id="l-ranked" ${l.ranked ? 'checked' : ''}> Listă clasament (numerotată)</label>
        <div class="field"><span class="lbl">Titluri în listă</span><div class="list-items" id="l-items"></div></div>
        <div class="field"><label>Adaugă din bibliotecă</label><input class="input" id="l-find" placeholder="Caută în bibliotecă…"><div class="pick-list" id="l-pick"></div></div>
      </div>
      <div class="modal-foot">
        ${isNew ? '' : '<button class="btn danger" id="l-del">Șterge lista</button>'}
        <span class="grow"></span>
        <button class="btn ghost" id="l-cancel">Anulează</button>
        <button class="btn primary" id="l-save">Salvează</button>
      </div>`);
    const $ = (s) => el.querySelector(s);
    const drawItems = () => {
      $('#l-items').innerHTML = l.items.length ? l.items.map((id, i) => {
        const t = byId.get(id);
        return `<div class="list-item"><span class="muted" style="text-align:center">${i + 1}</span>${thumb(t)}<span>${esc(t ? t.title : '?')}</span>
          <span style="white-space:nowrap"><button class="btn small ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn small ghost" data-down="${i}" ${i === l.items.length - 1 ? 'disabled' : ''}>↓</button><button class="btn small ghost" data-rm="${i}"><svg class="ic-x" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></span></div>`;
      }).join('') : '<div class="muted" style="font-size:14px">Lista e goală.</div>';
    };
    const drawPick = () => {
      const q = norm($('#l-find').value);
      const list = DB.titles.filter((t) => norm(t.title).includes(q)).sort((a, b) => a.title.localeCompare(b.title, 'ro')).slice(0, 50);
      $('#l-pick').innerHTML = list.map((t) => `<button data-add="${t.id}" ${l.items.includes(t.id) ? 'disabled' : ''}>${thumb(t).replace('class="thumb"', 'class="thumb" style="width:26px;aspect-ratio:2/3;border-radius:3px;overflow:hidden;flex:none"')}<span>${esc(t.title)} <span class="muted">${esc(t.year || '')}</span></span></button>`).join('') || '<div class="muted" style="padding:10px">Nimic.</div>';
    };
    drawItems(); drawPick();
    $('#l-find').addEventListener('input', drawPick);
    $('#l-pick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      l.items.push(b.dataset.add);
      drawItems(); drawPick();
    });
    $('#l-items').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const swap = (i, j) => { [l.items[i], l.items[j]] = [l.items[j], l.items[i]]; };
      if (b.dataset.up) swap(+b.dataset.up, +b.dataset.up - 1);
      if (b.dataset.down) swap(+b.dataset.down, +b.dataset.down + 1);
      if (b.dataset.rm) l.items.splice(+b.dataset.rm, 1);
      drawItems(); drawPick();
    });
    $('#l-cancel').addEventListener('click', close);
    if ($('#l-del')) $('#l-del').addEventListener('click', async () => {
      if (!confirm(`Ștergi lista „${l.name}”? Titlurile rămân în bibliotecă.`)) return;
      await run(() => api(`/api/lists/${l.id}`, { method: 'DELETE' }), 'Lista a fost ștearsă');
      close(); await reload(); renderPanel();
    });
    $('#l-save').addEventListener('click', async () => {
      const body = { name: $('#l-name').value.trim(), description: $('#l-desc').value.trim(), ranked: $('#l-ranked').checked, items: l.items };
      if (!body.name) return toast('Dă-i un nume listei.', true);
      await run(() => (isNew ? api('/api/lists', { method: 'POST', body }) : api(`/api/lists/${l.id}`, { method: 'PUT', body })), 'Salvat');
      close(); await reload(); renderPanel();
    });
  }

  // ---------- Alegere imagine din TMDB (ca pe Serializd) ----------

  // kind: 'backdrops' (banner / fundal) sau 'posters'. onPick(url, titlu) se apeleaza la click pe o imagine.
  function openImagePicker({ kind = 'backdrops', initial = null, heading = 'Alege serialul', season = null, onPick }) {
    const wide = kind === 'backdrops';
    const { el, close } = openModal(`
      <div class="modal-head" style="flex-direction:column;align-items:stretch;gap:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn small ghost hidden" id="ip-back">‹ Alt titlu</button>
          <h2 id="ip-head" style="flex:1">${esc(heading)}</h2>
          <button class="btn small ghost" id="ip-close" aria-label="Închide"><svg class="ic-x" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>
        <input class="input" id="ip-q" placeholder="Caută un serial sau film…" ${STATE.hasTmdb ? '' : 'disabled'}>
      </div>
      <div class="modal-body" id="ip-body"></div>`);
    el.style.maxWidth = '980px';
    const $ = (s) => el.querySelector(s);
    const body = $('#ip-body');
    let timer;

    const libTitles = DB.titles.filter((t) => t.tmdbId);
    const titleButton = (t, i, src) => `<button class="result" data-src="${src}" data-i="${i}">
        <div class="poster-img">${t.poster ? `<img src="${esc(t.poster)}" alt="" loading="lazy">` : `<div class="poster-fallback"><span>${esc(t.title)}</span></div>`}</div>
        <div class="t">${esc(t.title)}</div><div class="y">${esc(t.year || '')} · ${t.type === 'tv' ? 'Serial' : 'Film'}</div>
      </button>`;

    let found = [];
    function showChooser() {
      $('#ip-back').classList.add('hidden');
      $('#ip-q').classList.remove('hidden');
      $('#ip-head').textContent = heading;
      if (!STATE.hasTmdb) {
        const local = DB.titles.filter((t) => (wide ? t.backdrop : t.poster));
        body.innerHTML = `<div class="box">Pentru toate imaginile unui serial ai nevoie de cheia TMDB (Setări). Până atunci poți alege din imaginile titlurilor tale:</div>
          <div class="img-pick" style="max-height:none">${local.map((t, i) => `<button type="button" data-local="${i}" title="${esc(t.title)}" ${wide ? '' : 'style="aspect-ratio:2/3"'}><img src="${esc(wide ? t.backdrop.replace('/w1280/', '/w300/') : t.poster)}" alt="" loading="lazy"></button>`).join('') || '<span class="muted">Nimic încă.</span>'}</div>`;
        body.onclick = (e) => {
          const b = e.target.closest('[data-local]');
          if (!b) return;
          const t = local[Number(b.dataset.local)];
          onPick(wide ? t.backdrop : t.poster, t.title);
          close();
        };
        return;
      }
      const q = $('#ip-q').value.trim();
      body.innerHTML = q
        ? (found.length ? `<div class="results" style="margin:0">${found.map((t, i) => titleButton(t, i, 'f')).join('')}</div>` : '<div class="muted">Nimic găsit.</div>')
        : (libTitles.length ? `<div class="muted" style="font-size:13px;margin-bottom:8px">Din biblioteca ta</div><div class="results" style="margin:0">${libTitles.map((t, i) => titleButton(t, i, 'l')).join('')}</div>` : '<div class="muted">Caută un serial sau film mai sus.</div>');
      body.onclick = (e) => {
        const b = e.target.closest('.result');
        if (!b) return;
        const t = (b.dataset.src === 'f' ? found : libTitles)[Number(b.dataset.i)];
        showImages(t);
      };
    }

    async function showImages(t) {
      $('#ip-back').classList.remove('hidden');
      $('#ip-q').classList.add('hidden');
      $('#ip-head').textContent = t.title;
      body.innerHTML = '<div class="muted">Încarc imaginile…</div>';
      body.onclick = null;
      let imgs;
      try { imgs = await api(`/api/tmdb/images?type=${t.type}&id=${t.tmdbId}${season != null && t === initial ? `&season=${season}` : ''}`); } catch (err) { body.innerHTML = `<div class="muted">${esc(err.message)}</div>`; return; }
      const list = imgs[kind];
      body.innerHTML = list.length
        ? `<div class="muted" style="font-size:13px;margin-bottom:10px">${list.length} imagini · click pe cea dorită</div>
           <div class="img-pick" style="max-height:none;grid-template-columns:repeat(auto-fill,minmax(${wide ? 280 : 130}px,1fr))">${list.map((im, i) => `<button type="button" data-img="${i}" ${wide ? '' : 'style="aspect-ratio:2/3"'}><img src="${esc(im.thumb)}" alt="" loading="lazy"></button>`).join('')}</div>`
        : '<div class="muted">Titlul ăsta nu are imagini.</div>';
      body.onclick = (e) => {
        const b = e.target.closest('[data-img]');
        if (!b) return;
        onPick(list[Number(b.dataset.img)].url, t.title);
        close();
      };
    }

    $('#ip-close').addEventListener('click', close);
    $('#ip-back').addEventListener('click', showChooser);
    $('#ip-q').addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = $('#ip-q').value.trim();
        found = q ? await api(`/api/tmdb/search?type=multi&q=${encodeURIComponent(q)}`).catch(() => []) : [];
        showChooser();
      }, 350);
    });
    if (initial && initial.tmdbId && STATE.hasTmdb) showImages(initial); else showChooser();
    if (!initial && STATE.hasTmdb) $('#ip-q').focus();
  }

  // ---------- Setari (structurate ca pe Serializd → Settings) ----------

  let settingsPage = '';

  const SETTINGS_MENU = [
    ['Profil', [
      ['bio', '✎', 'Nume, bio și poză'],
      ['favorites', '★', 'Seriale favorite'],
      ['color', '◐', 'Culoare'],
      ['privacy', '🔒', 'Confidențialitate'],
      ['friends', '☺', 'Prieteni'],
    ]],
    ['Postere și bannere', [
      ['banner', '▭', 'Banner profil'],
      ['statsBanner', '▤', 'Banner statistici'],
      ['posters', '▯', 'Postere personalizate'],
      ['seasonPosters', '▯', 'Postere sezoane personalizate'],
      ['showBanners', '▭', 'Bannere seriale personalizate'],
      ['brand', '◆', 'Logo și iconițe'],
    ]],
    ['Date', [
      ['import', '⇪', 'Import din listă'],
      ['backup', '⇅', 'Backup și restaurare'],
    ]],
    ['Cont', [
      ['tmdb', '⚿', 'TMDB și limbă (administrator)'],
      ['region', '⌖', 'Locație (unde poți viziona)'],
      ['password', '⚙', 'Parolă'],
    ]],
  ];

  async function saveProfile(body, msg) {
    DB.profile = await run(() => api('/api/profile', { method: 'PUT', body }), msg);
    return DB.profile;
  }

  function panelSettings(panel) {
    const pages = {
      bio: setBio, favorites: setFavorites, color: setColor, privacy: setPrivacy,
      banner: (el) => setBanner(el, 'banner', 'bannerFrom', 'Banner profil', 'Apare sus pe profilul tău.'),
      statsBanner: (el) => setBanner(el, 'statsBanner', 'statsBannerFrom', 'Banner statistici', 'Apare sus pe pagina Statistici. Gol = același ca bannerul de profil.'),
      posters: (el) => setCustomImages(el, 'poster'),
      seasonPosters: (el) => setCustomImages(el, 'season'),
      showBanners: (el) => setCustomImages(el, 'backdrop'),
      friends: setFriends, brand: setBrand, import: setImport, backup: setBackup, tmdb: setTmdb, region: setRegion, password: setPassword,
    };
    if (settingsPage && pages[settingsPage]) {
      const label = SETTINGS_MENU.flatMap((g) => g[1]).find((x) => x[0] === settingsPage)[2];
      panel.innerHTML = `<button class="btn ghost small" id="set-back" style="margin-bottom:10px">‹ Înapoi la setări</button>
        <div class="panel-title">${esc(label)}</div><div id="set-body"></div>`;
      panel.querySelector('#set-back').addEventListener('click', () => { settingsPage = ''; renderPanel(); });
      pages[settingsPage](panel.querySelector('#set-body'));
      return;
    }
    panel.innerHTML = `<div class="panel-title">Setări</div>
      ${SETTINGS_MENU.map(([group, rows]) => [group, rows.filter(([k]) => k !== 'tmdb' || STATE.isSiteAdmin)]).map(([group, rows]) => `<div class="set-group"><h4>${group}</h4>
        ${rows.map(([k, ic, label]) => `<button class="set-row" data-page="${k}"><span class="ic">${ic}</span>${label}<span class="arrow">→</span></button>`).join('')}
      </div>`).join('')}`;
    panel.onclick = (e) => {
      const b = e.target.closest('[data-page]');
      if (!b) return;
      settingsPage = b.dataset.page;
      renderPanel();
      window.scrollTo(0, 0);
    };
  }

  // --- Profil: nume, bio, poza ---
  function setBio(el) {
    const p = DB.profile;
    el.innerHTML = `<form id="pf">
        <div class="row-fields">
          <div class="field"><label>Nume afișat</label><input class="input" name="name" value="${esc(p.name)}"></div>
          <div class="field"><label>Username (apare ca @username)</label><input class="input" name="username" value="${esc(p.username || '')}" placeholder="ex: ionutzz"></div>
          <div class="field"><label>Membru din</label><input class="input" type="date" name="joined" value="${esc(p.joined)}"></div>
        </div>
        <div class="field"><label>Bio</label><textarea class="textarea" name="bio" style="min-height:90px">${esc(p.bio)}</textarea></div>
        <div class="field"><span class="lbl">Poză de profil</span>
          <div style="display:flex;gap:14px;align-items:center">
            <div id="av-prev">${p.avatar ? `<img class="avatar" src="${esc(p.avatar)}" alt="">` : `<div class="avatar">${esc(p.name.charAt(0).toUpperCase())}</div>`}</div>
            <div style="flex:1;display:flex;gap:8px"><input class="input" name="avatar" placeholder="URL imagine" value="${esc(p.avatar)}"><label class="btn small" style="height:38px">Încarcă<input type="file" accept="image/*" id="av-file" hidden></label></div>
          </div>
        </div>
        <button class="btn primary">Salvează</button>
      </form>`;
    const f = el.querySelector('#pf');
    const setAvatar = (url) => { f.avatar.value = url; el.querySelector('#av-prev').innerHTML = url ? `<img class="avatar" src="${esc(url)}" alt="">` : ''; };
    f.avatar.addEventListener('change', () => setAvatar(f.avatar.value.trim()));
    el.querySelector('#av-file').addEventListener('change', async (e) => {
      if (e.target.files[0]) setAvatar(await run(() => uploadImage(e.target.files[0], 400), 'Imagine încărcată'));
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProfile({ name: f.name.value, username: f.username.value, bio: f.bio.value, joined: f.joined.value, avatar: f.avatar.value.trim() }, 'Salvat');
      f.username.value = DB.profile.username;
    });
  }

  // --- Favorite: 5 locuri ordonate ---
  function setFavorites(el) {
    const byId = new Map(DB.titles.map((t) => [t.id, t]));
    const favs = (DB.profile.favorites || []).filter((id) => byId.has(id));
    el.innerHTML = `<p class="muted" style="margin-top:0">Alege până la 5 titluri. Apar în această ordine pe profil.</p>
      <div class="fav-slots">${Array.from({ length: 5 }, (_, i) => {
        const t = byId.get(favs[i]);
        return t
          ? `<div class="fav-slot">${poster(t, { showMeta: false })}
              <div class="fav-actions"><button class="btn small ghost" data-left="${i}" ${i === 0 ? 'disabled' : ''}>‹</button><button class="btn small ghost" data-rm="${i}"><svg class="ic-x" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><button class="btn small ghost" data-right="${i}" ${i === favs.length - 1 ? 'disabled' : ''}>›</button></div></div>`
          : `<button class="fav-slot empty" data-add="${i}">+</button>`;
      }).join('')}</div>`;
    const save = async (list) => { await saveProfile({ favorites: list }, 'Favorite salvate'); await reload(); setFavorites(el); };
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const list = [...favs];
      if (b.dataset.rm) { list.splice(+b.dataset.rm, 1); return save(list); }
      if (b.dataset.left) { const i = +b.dataset.left; [list[i - 1], list[i]] = [list[i], list[i - 1]]; return save(list); }
      if (b.dataset.right) { const i = +b.dataset.right; [list[i + 1], list[i]] = [list[i], list[i + 1]]; return save(list); }
      if (b.dataset.add) pickFromLibrary((id) => save([...list, id]), list);
    };
  }

  function pickFromLibrary(onPick, exclude = []) {
    const { el, close } = openModal(`
      <div class="modal-head" style="flex-direction:column;align-items:stretch;gap:12px">
        <div style="display:flex;align-items:center"><h2 style="flex:1">Alege din bibliotecă</h2><button class="btn small ghost" id="pk-close" aria-label="Închide"><svg class="ic-x" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
        <input class="input" id="pk-q" placeholder="Caută…">
      </div>
      <div class="modal-body"><div class="results" id="pk-res" style="margin:0"></div></div>`);
    el.style.maxWidth = '980px';
    const draw = () => {
      const q = norm(el.querySelector('#pk-q').value);
      const list = DB.titles.filter((t) => !exclude.includes(t.id) && norm(t.title).includes(q)).sort((a, b) => a.title.localeCompare(b.title, 'ro'));
      el.querySelector('#pk-res').innerHTML = list.map((t) => `<button class="result" data-id="${t.id}">${poster(t, { showMeta: false })}<div class="t">${esc(t.title)}</div><div class="y">${esc(t.year || '')}</div></button>`).join('') || '<div class="muted">Nimic. Adaugă întâi titluri în bibliotecă.</div>';
    };
    draw();
    el.querySelector('#pk-q').addEventListener('input', draw);
    el.querySelector('#pk-q').focus();
    el.querySelector('#pk-close').addEventListener('click', close);
    el.querySelector('#pk-res').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (b) { close(); onPick(b.dataset.id); }
    });
  }

  // --- Culoare ---
  function setColor(el) {
    const current = (DB.profile.accent || '').toLowerCase();
    el.innerHTML = `<p class="muted" style="margin-top:0">Culoarea se aplică pe tot site-ul: butoane, stele, tab-uri, grafice.</p>
      <div class="swatches">${WL.COLORS.map(([name, hex]) => `<button class="swatch-row ${hex === current ? 'on' : ''}" data-hex="${hex}"><span class="swatch" style="background:${hex}"></span>${name}${hex === current ? '<span class="arrow">✓</span>' : ''}</button>`).join('')}</div>
      <div class="field" style="margin-top:18px;max-width:320px"><label>Sau orice culoare</label>
        <div style="display:flex;gap:10px;align-items:center"><input type="color" id="c-custom" value="${esc(current || '#d8d2c9')}" style="width:54px;height:40px;border:0;background:none;padding:0;cursor:pointer"><button class="btn" id="c-save">Folosește culoarea</button></div>
      </div>`;
    const apply = async (hex) => {
      WL.applyAccent(hex);
      await saveProfile({ accent: hex }, 'Culoare schimbată');
      setColor(el);
    };
    el.querySelectorAll('[data-hex]').forEach((b) => b.addEventListener('click', () => apply(b.dataset.hex)));
    el.querySelector('#c-custom').addEventListener('input', (e) => WL.applyAccent(e.target.value));
    el.querySelector('#c-save').addEventListener('click', () => apply(el.querySelector('#c-custom').value));
  }

  // --- Confidentialitate ---
  function setPrivacy(el) {
    const p = DB.profile;
    el.innerHTML = `
      <label class="switch-row"><span><b>Profil privat</b><span class="muted">Vizitatorii văd doar numele și poza. Tu (logat în admin) vezi tot.</span></span><input type="checkbox" id="pv-private" ${p.private ? 'checked' : ''}></label>
      <label class="switch-row"><span><b>Arată statisticile pe profil</b><span class="muted">Timpul petrecut, graficul de rating și tab-ul Statistici.</span></span><input type="checkbox" id="pv-stats" ${p.showStats !== false ? 'checked' : ''}></label>`;
    el.querySelector('#pv-private').addEventListener('change', (e) => saveProfile({ private: e.target.checked }, e.target.checked ? 'Profilul e privat' : 'Profilul e public'));
    el.querySelector('#pv-stats').addEventListener('change', (e) => saveProfile({ showStats: e.target.checked }, 'Salvat'));
  }

  // --- Bannere (profil / statistici) ---
  function setBanner(el, field, fromField, heading, hint) {
    const p = DB.profile;
    el.innerHTML = `<p class="muted" style="margin-top:0">${hint} Alege un serial ca să vezi toate imaginile lui de fundal.</p>
      <div class="banner-preview" style="${p[field] ? `background-image:url('${esc(p[field])}')` : ''}"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">
        <button type="button" class="btn primary" id="bn-pick">Alege serialul</button>
        <label class="btn">Încarcă poză<input type="file" accept="image/*" id="bn-file" hidden></label>
        <button type="button" class="btn ghost" id="bn-auto">Automat</button>
        <span class="muted" style="font-size:14px">${p[field] ? (p[fromField] ? `Serial selectat: <b style="color:var(--text)">${esc(p[fromField])}</b>` : 'Imagine proprie') : 'Automat'}</span>
      </div>`;
    const save = async (url, from) => { await saveProfile({ [field]: url, [fromField]: from }, url ? 'Banner schimbat' : 'Banner automat'); setBanner(el, field, fromField, heading, hint); };
    el.querySelector('#bn-pick').addEventListener('click', () => {
      const current = DB.titles.find((t) => t.title === p[fromField] && t.tmdbId);
      openImagePicker({ kind: 'backdrops', heading: 'Alege serialul — ' + heading.toLowerCase(), initial: current, onPick: (url, title) => save(url, title) });
    });
    el.querySelector('#bn-auto').addEventListener('click', () => save('', ''));
    el.querySelector('#bn-file').addEventListener('change', async (e) => {
      if (e.target.files[0]) save(await run(() => uploadImage(e.target.files[0], 1600), 'Imagine încărcată'), '');
    });
  }

  // --- Postere / bannere / postere sezoane personalizate ---
  function setCustomImages(el, mode) {
    const titles = DB.titles.filter((t) => t.tmdbId && (mode !== 'season' || (t.type === 'tv' && (t.seasons || []).length)));
    const text = {
      poster: 'Alege alt poster pentru un serial sau film. Apare peste tot pe site.',
      backdrop: 'Alege alt fundal (banner) pentru pagina unui serial sau film.',
      season: 'Alege alt poster pentru un sezon anume.',
    }[mode];
    el.innerHTML = `<p class="muted" style="margin-top:0">${text}${STATE.hasTmdb ? '' : ' <b>Ai nevoie de cheia TMDB (Setări → TMDB și limbă).</b>'}</p>
      <input class="input" id="ci-q" placeholder="Filtrează…" style="margin-bottom:14px">
      <div class="results" id="ci-res" style="margin:0"></div>`;
    const draw = () => {
      const q = norm(el.querySelector('#ci-q').value);
      el.querySelector('#ci-res').innerHTML = titles.filter((t) => norm(t.title).includes(q)).map((t) => {
        const img = mode === 'backdrop'
          ? `<div class="poster-img" style="aspect-ratio:16/9">${t.backdrop ? `<img src="${esc(t.backdrop.replace('/w1280/', '/w300/'))}" alt="" loading="lazy">` : ''}</div>`
          : poster(t, { showMeta: false });
        return `<button class="result" data-id="${t.id}">${img}<div class="t">${esc(t.title)}</div><div class="y">${esc(t.year || '')}</div></button>`;
      }).join('') || '<div class="muted">Niciun titlu din TMDB în bibliotecă.</div>';
    };
    draw();
    el.querySelector('#ci-q').addEventListener('input', draw);
    el.querySelector('#ci-res').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const t = DB.titles.find((x) => x.id === b.dataset.id);
      const done = async (body, msg) => { await run(() => api(`/api/titles/${t.id}`, { method: 'PUT', body }), msg); await reload(); setCustomImages(el, mode); };
      if (mode === 'poster') openImagePicker({ kind: 'posters', heading: 'Alege posterul', initial: t, onPick: (url) => done({ poster: url }, 'Poster schimbat') });
      if (mode === 'backdrop') openImagePicker({ kind: 'backdrops', heading: 'Alege bannerul', initial: t, onPick: (url) => done({ backdrop: url }, 'Banner schimbat') });
      if (mode === 'season') pickSeason(t, (s) => openImagePicker({
        kind: 'posters', heading: `Poster — ${s.name}`, initial: t, season: s.number,
        onPick: (url) => done({ seasons: t.seasons.map((x) => (x.number === s.number ? { ...x, poster: url } : x)) }, 'Poster de sezon schimbat'),
      }));
    });
  }

  function pickSeason(t, onPick) {
    const { el, close } = openModal(`<div class="modal-head"><h2 style="flex:1">${esc(t.title)} — alege sezonul</h2><button class="btn small ghost" id="ps-close" aria-label="Închide"><svg class="ic-x" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <div class="modal-body"><div class="results" style="margin:0">${t.seasons.map((s, i) => `<button class="result" data-i="${i}"><div class="poster-img">${s.poster ? `<img src="${esc(s.poster)}" alt="" loading="lazy">` : `<div class="poster-fallback"><span>${esc(s.name)}</span></div>`}</div><div class="t">${esc(s.name)}</div><div class="y">${s.episodes} ep.</div></button>`).join('')}</div></div>`);
    el.querySelector('#ps-close').addEventListener('click', close);
    el.querySelector('.modal-body').addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) { close(); onPick(t.seasons[Number(b.dataset.i)]); }
    });
  }

  // --- Import din lista ---
  function setImport(el) {
    el.innerHTML = `<p class="muted" style="margin-top:0">Lipește titluri, câte unul pe rând. Poți pune anul în paranteză ca să fie găsit exact, ex: <code>Dexter (2006)</code>. Fiecare titlu e căutat pe TMDB și adăugat cu primul rezultat.</p>
      ${STATE.hasTmdb ? '' : '<div class="box">Ai nevoie de cheia TMDB (Setări → TMDB și limbă).</div>'}
      <div class="field"><textarea class="textarea" id="im-text" style="min-height:200px" placeholder="Breaking Bad&#10;The Office (2005)&#10;Inception"></textarea></div>
      <div class="row-fields">
        <div class="field"><label>Tip</label><select id="im-type"><option value="tv">Seriale</option><option value="movie">Filme</option><option value="multi">Detectează automat</option></select></div>
        <div class="field"><label>Status</label><select id="im-status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select></div>
      </div>
      <button class="btn primary" id="im-go" ${STATE.hasTmdb ? '' : 'disabled'}>Importă</button>
      <div id="im-log" class="import-log"></div>`;
    el.querySelector('#im-go').addEventListener('click', async (e) => {
      const lines = el.querySelector('#im-text').value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return toast('Lista e goală.', true);
      const type = el.querySelector('#im-type').value;
      const status = el.querySelector('#im-status').value;
      const log = el.querySelector('#im-log');
      const write = (cls, msg) => { log.insertAdjacentHTML('beforeend', `<div class="${cls}">${msg}</div>`); };
      e.target.disabled = true;
      let added = 0;
      for (const line of lines) {
        const m = /^(.*?)\s*\((\d{4})\)\s*$/.exec(line);
        const q = m ? m[1] : line;
        const year = m ? m[2] : '';
        try {
          const res = await api(`/api/tmdb/search?type=${type}&q=${encodeURIComponent(q)}`);
          const hit = res.find((r) => !year || r.year === year) || res[0];
          if (!hit) { write('err', `✕ ${esc(line)} — negăsit`); continue; }
          if (DB.titles.some((t) => t.tmdbId === hit.tmdbId && t.type === hit.type)) { write('muted', `• ${esc(hit.title)} (${esc(hit.year)}) — exista deja`); continue; }
          const details = await api(`/api/tmdb/details?type=${hit.type}&id=${hit.tmdbId}`);
          const saved = await api('/api/titles', { method: 'POST', body: { ...details, status } });
          DB.titles.push(saved);
          added++;
          write('ok', `✓ ${esc(saved.title)} (${esc(saved.year)})`);
        } catch (err) { write('err', `✕ ${esc(line)} — ${esc(err.message)}`); }
      }
      write('muted', `Gata: ${added} adăugate din ${lines.length}.`);
      e.target.disabled = false;
      await reload();
    });
  }

  // --- Logo si iconite (generate in toate culorile paletei) ---
  function setBrand(el) {
    const FILES = [
      ['logo-mare', 'Logo mare', '2400×640, fundal transparent, text alb (pentru fundal închis)', '16/4.3'],
      ['logo-mare-deschis', 'Logo mare (fundal deschis)', '2400×640, fundal transparent, text închis', '16/4.3'],
      ['icon', 'Iconiță / poză de profil', '1024×1024, pentru Instagram, Discord, YouTube etc.', '1'],
      ['og-image', 'Imagine pentru share', '1200×630, apare când trimiți link-ul pe WhatsApp, Discord, Facebook', '1200/630'],
      ['favicon', 'Semnul singur', '512×512, fundal transparent', '1'],
      ['apple-touch-icon', 'Iconiță ecran de start', '180×180, când adaugi site-ul pe ecranul telefonului', '1'],
    ];
    const current = (DB.profile.accent || '').toLowerCase();
    let pick = WL.COLORS.some(([, h]) => h === current) ? current : WL.COLORS[0][1];
    const draw = () => {
      const dir = `brand/generat/${pick.slice(1)}/`;
      el.innerHTML = `<p class="muted" style="margin-top:0">Logo-ul EDITSEL în toate culorile. Pe site, favicon-ul, iconița de pe telefon și imaginea de share se schimbă automat după culoarea profilului.</p>
        <div class="seg" id="br-colors" style="margin-bottom:18px">${WL.COLORS.map(([n, h]) => `<button type="button" data-hex="${h}" class="${h === pick ? 'on' : ''}" title="${n}" style="display:inline-flex;align-items:center;gap:8px"><span class="swatch" style="width:16px;height:16px;border-radius:5px;background:${h}"></span>${n}</button>`).join('')}</div>
        <div class="brand-grid">${FILES.map(([f, title, desc, ratio]) => `<div class="card brand-card">
            <div class="brand-prev ${f === 'logo-mare-deschis' ? 'light' : ''}" style="aspect-ratio:${ratio}"><img src="${dir}${f}.png" alt="" loading="lazy"></div>
            <b>${title}</b><span class="muted">${desc}</span>
            <a class="btn small" href="${dir}${f}.png" download="editsel-${f}-${pick.slice(1)}.png">⇩ Descarcă</a>
          </div>`).join('')}</div>`;
      el.querySelector('#br-colors').addEventListener('click', (e) => {
        const b = e.target.closest('[data-hex]');
        if (b) { pick = b.dataset.hex; draw(); }
      });
    };
    draw();
  }

  // --- Prieteni: se gestioneaza pe pagina /friends a site-ului (cereri, acceptare) ---
  function setFriends(el) {
    el.innerHTML = `<p class="muted" style="margin-top:0">Prietenii se adaugă prin cereri de prietenie: trimiți o cerere, iar când celălalt o acceptă deveniți prieteni și vă vedeți activitatea.</p>
      <a class="btn primary" href="friends">☺ Deschide pagina Prieteni</a>`;
  }

  // --- Backup ---
  function setBackup(el) {
    el.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <h3>Descarcă tot</h3>
        <p class="muted" style="margin-top:0;font-size:14px">Un fișier JSON cu profilul, titlurile, jurnalul și listele.</p>
        <button class="btn primary" id="exp">⇩ Descarcă backup</button>
      </div>
      <div class="card">
        <h3>Restaurează din backup</h3>
        <p class="muted" style="margin-top:0;font-size:14px">Înlocuiește toate datele actuale. Descarcă întâi un backup, dacă vrei să păstrezi datele actuale.</p>
        <label class="btn">⇧ Alege fișierul<input type="file" accept="application/json,.json" id="imp" hidden></label>
      </div>`;
    el.querySelector('#exp').addEventListener('click', async () => {
      const b = await WL.backend();
      const data = await run(() => b.exportMine());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `editsel-${DB.profile.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    el.querySelector('#imp').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { return toast('Fișierul nu e JSON valid.', true); }
      if (!confirm(`Restaurezi backup-ul? (${(data.titles || []).length} titluri, ${(data.diary || []).length} intrări în jurnal)`)) return;
      await run(() => api('/api/import', { method: 'POST', body: data }), 'Backup restaurat');
      await reload();
      WL.applyAccent(DB.profile.accent);
    });
  }

  // --- Cont ---
  async function setTmdb(el) {
    const s = await api('/api/settings');
    el.innerHTML = `<form id="sf">
        <div class="field"><label>Cheie API TMDB (v3) sau token de citire (v4)</label>
          <input class="input" name="tmdbKey" value="${esc(s.tmdbKey)}" placeholder="lipește cheia aici" autocomplete="off">
          <span class="hint">Gratuit: cont pe <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener">themoviedb.org</a>, apoi <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">Setări → API</a>. Cheia rămâne doar pe serverul tău.</span>
        </div>
        <div class="field" style="max-width:260px"><label>Limba descrierilor</label>
          <select name="language"><option value="ro-RO">Română</option><option value="en-US">English</option></select></div>
        <button class="btn primary">Salvează</button>
      </form>`;
    const f = el.querySelector('#sf');
    f.language.value = s.language;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      await run(() => api('/api/settings', { method: 'PUT', body: { tmdbKey: f.tmdbKey.value, language: f.language.value } }), 'Salvat');
      STATE = await api('/api/admin/status');
    });
  }

  const REGIONS = [['RO', 'România'], ['MD', 'Moldova'], ['US', 'SUA'], ['GB', 'Marea Britanie'], ['DE', 'Germania'], ['IT', 'Italia'], ['ES', 'Spania'], ['FR', 'Franța'], ['NL', 'Olanda'], ['AT', 'Austria'], ['HU', 'Ungaria'], ['CA', 'Canada']];
  function setRegion(el) {
    el.innerHTML = `<p class="muted" style="margin-top:0">Pe pagina fiecărui titlu apare „Unde poți viziona” (Netflix, HBO Max, Disney+ etc.) pentru țara aleasă.</p>
      <div class="field" style="max-width:300px"><label>Țara</label><select id="rg">${REGIONS.map(([c, n]) => `<option value="${c}" ${DB.profile.region === c ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    el.querySelector('#rg').addEventListener('change', (e) => saveProfile({ region: e.target.value }, 'Țară salvată'));
  }

  function setPassword(el) {
    el.innerHTML = `<form id="pw" style="max-width:420px">
        <div class="field"><label>Parola actuală</label><input class="input" type="password" name="p0" autocomplete="current-password" required></div>
        <div class="field"><label>Parolă nouă</label><input class="input" type="password" name="p1" autocomplete="new-password" minlength="6" required></div>
        <div class="field"><label>Confirmă</label><input class="input" type="password" name="p2" autocomplete="new-password" required></div>
        <button class="btn primary">Schimbă parola</button>
      </form>`;
    el.querySelector('#pw').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.p1.value !== f.p2.value) return toast('Parolele nu coincid.', true);
      await run(() => api('/api/settings', { method: 'PUT', body: { currentPassword: f.p0.value, newPassword: f.p1.value } }), 'Parolă schimbată');
      f.reset();
    });
  }

  boot().catch((e) => { root.innerHTML = `<div class="auth-box card">${esc(e.message)}</div>`; });
})();
