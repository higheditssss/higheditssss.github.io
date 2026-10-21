// Utilitare comune pentru pagina publica si admin.
(function () {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // iconite SVG folosite peste tot (in locul emoji-urilor)
  const ICON_PATHS = {
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h6M8 12h6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  };
  // pline (stea, inima)
  const ICON_FILLED = {
    star: '<path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9z"/>',
    heart: '<path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 5 6.6 5c2.1 0 3.6 1.2 5.4 3 1.8-1.8 3.3-3 5.4-3 3.6 0 5.7 3.6 4.2 6.9C19.5 16.4 12 21 12 21z"/>',
  };
  function ic(name, cls = '') {
    if (ICON_FILLED[name]) return `<svg class="ico ico-fill ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON_FILLED[name]}</svg>`;
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
  }

  const STATUS = {
    watching: { label: 'Mă uit acum', short: 'În curs', icon: ic('play') },
    watched: { label: 'Văzut', short: 'Văzute', icon: ic('eye') },
    watchlist: { label: 'De văzut', short: 'De văzut', icon: ic('clock') },
    paused: { label: 'Pe pauză', short: 'Pauză', icon: ic('pause') },
    dropped: { label: 'Abandonat', short: 'Abandonate', icon: ic('trash') },
  };

  const MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
  const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const DAYS = ['DUM', 'LUN', 'MAR', 'MIE', 'JOI', 'VIN', 'SÂM'];

  function parseDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = parseDate(iso);
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Stele: 5 icoane, fiecare plina / jumatate / goala.
  function stars(value, extraClass = '') {
    const v = Number(value) || 0;
    if (!v) return '';
    let html = `<span class="stars ${extraClass}" title="${v} / 5" aria-label="${v} din 5 stele">`;
    for (let i = 1; i <= 5; i++) {
      const cls = v >= i ? 'full' : v >= i - 0.5 ? 'half' : 'empty';
      html += `<span class="star ${cls}">${ic('star')}${cls === 'half' ? `<span class="h">${ic('star')}</span>` : ''}</span>`;
    }
    return html + '</span>';
  }

  const heart = (on) => (on ? `<span class="heart" title="Îmi place">${ic('heart')}</span>` : '');

  function poster(t, opts = {}) {
    const { href, size = '', showMeta = true, rank } = opts;
    const img = t.poster
      ? `<img src="${esc(t.poster)}" alt="${esc(t.title)}" loading="lazy">`
      : `<div class="poster-fallback"><span>${esc(t.title)}</span></div>`;
    const meta = showMeta && (t.rating || t.liked)
      ? `<div class="poster-meta">${stars(t.rating)}${heart(t.liked)}</div>` : '';
    const tag = href ? 'a' : 'div';
    return `<${tag} class="poster ${size}" ${href ? `href="${esc(href)}"` : ''} title="${esc(t.title)}${t.year ? ' (' + esc(t.year) + ')' : ''}">
      <div class="poster-img">${rank ? `<span class="rank">${rank}</span>` : ''}${img}</div>${meta}
    </${tag}>`;
  }

  // Minute vizionate + episoade.
  function watchTime(titles) {
    let tvMin = 0, movieMin = 0, episodes = 0, seasons = 0;
    for (const t of titles) {
      if (t.type === 'tv') {
        const eps = t.status === 'watched' ? (t.episodesWatched || t.episodesCount || 0) : (t.episodesWatched || 0);
        episodes += eps;
        tvMin += eps * (t.runtime || 0);
        if (t.status === 'watched') seasons += t.seasonsCount || 0;
        else if (t.episodesCount && t.seasonsCount && eps) seasons += Math.floor((eps / t.episodesCount) * t.seasonsCount);
      } else if (t.status === 'watched') {
        movieMin += t.runtime || 0;
      }
    }
    return { tvMin, movieMin, episodes, seasons };
  }

  function splitMinutes(min) {
    const h = Math.floor(min / 60);
    const months = Math.floor(h / (24 * 30));
    const days = Math.floor((h - months * 24 * 30) / 24);
    const hours = h % 24;
    return { months, days, hours, totalHours: h };
  }

  function histogram(values) {
    const buckets = Array(10).fill(0); // 0.5 .. 5
    values.forEach((v) => { if (v) buckets[Math.round(v * 2) - 1]++; });
    const max = Math.max(1, ...buckets);
    return `<div class="histogram">
      <span class="hist-label">${ic('star')}</span>
      <div class="hist-bars">${buckets.map((c, i) => `<div class="hist-bar" style="height:${Math.max(c ? 6 : 2, (c / max) * 100)}%" title="${(i + 1) / 2} / 5 — ${c}"></div>`).join('')}</div>
      <span class="hist-label">${ic('star').repeat(5)}</span>
    </div>`;
  }

  // Backend-ul (Firebase, din backend.js) e asteptat prin window.WLBackend; fara el, se foloseste serverul local.
  if (!window.WLBackend) window.WLBackend = new Promise((resolve) => { window.__resolveBackend = resolve; });
  const backend = () => window.WLBackend;

  async function api(path, opts = {}) {
    const b = await backend();
    if (b && b.api) return b.api(path, opts);
    if (b && b.missingConfig) throw Object.assign(new Error('Site-ul nu e conectat încă la Firebase (firebase-config.js).'), { status: 503 });
    const r = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'Eroare ' + r.status), { status: r.status });
    return data;
  }

  // Paleta de culori pentru profil (ca la Serializd → Color) + orice culoare custom.
  const COLORS = [
    ['Alb crem', '#d8d2c9'],
    ['Mov', '#7c4dff'],
    ['Albastru regal', '#5b7cfa'],
    ['Auriu', '#f4b942'],
    ['Portocaliu apus', '#ff5a1f'],
    ['Coral', '#ff7f50'],
    ['Roșu cinema', '#e5374b'],
    ['Vișiniu', '#9b1c2e'],
    ['Roz', '#ff69b4'],
    ['Prună', '#dda0dd'],
    ['Turcoaz', '#1fb5a5'],
    ['Verde neon', '#8ace00'],
    ['Verde vânător', '#3f7a4a'],
    ['Alb perlat', '#f2f0eb'],
    ['Argintiu', '#b9c1cc'],
    ['Gri ardezie', '#64748b'],
    ['Negru onix', '#34343c'],
    ['Bej nisip', '#c9ad87'],
    ['Cafeniu', '#8d6e63'],
    ['Cupru', '#c77848'],
    ['Piersică', '#ffb38a'],
    ['Galben lămâie', '#f5db4f'],
    ['Roșu rubin', '#c6284b'],
    ['Zmeură', '#d94f88'],
    ['Roz pudrat', '#e8a9c0'],
    ['Lavandă', '#b69cff'],
    ['Indigo', '#4f46e5'],
    ['Albastru petrol', '#247b91'],
    ['Albastru gheață', '#9ed8ef'],
    ['Verde mentă', '#8bd9ba'],
    ['Verde smarald', '#1fa774'],
    ['Verde salvie', '#9eaf8c'],
  ];

  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
  const luminance = (h) => {
    const [r, g, b] = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  function applyAccent(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) hex = COLORS[0][1];
    const L = luminance(hex);
    // pe fundal negru, culorile prea inchise devin greu de citit: textul de accent se deschide
    const text = L < 0.12 ? mix(hex, '#ffffff', 0.5) : L < 0.3 ? mix(hex, '#ffffff', 0.25) : hex;
    const vars = {
      '--accent': hex,
      '--accent-hover': mix(hex, '#ffffff', 0.15),
      '--accent-ink': L > 0.4 ? '#111014' : '#ffffff',
      '--accent-soft': mix(hex, '#121215', 0.82),
      '--accent-text': text,
      '--accent-deep': mix(hex, '#000000', 0.45),
      '--star': text,
      '--star-accent': text,
    };
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
    try { setFavicon(hex); } catch (e) { /* favicon optional */ }
  }

  // Semnul EDITSEL: romb in culoarea de accent, cu un „E” decupat.
  // Cu hex -> culori fixe (fisiere, favicon); fara hex -> variabilele CSS ale site-ului.
  function logoSvg(hex, { size = 100, id = 'g' } = {}) {
    const light = hex ? mix(hex, '#ffffff', 0.28) : 'var(--accent-hover)';
    const base = hex || 'var(--accent)';
    const deep = hex ? mix(hex, '#000000', 0.32) : 'var(--accent-deep)';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color:${light}"/><stop offset=".55" style="stop-color:${base}"/><stop offset="1" style="stop-color:${deep}"/>
        </linearGradient>
        <mask id="${id}m"><rect width="100" height="100" fill="#fff"/>
          <path fill="#000" d="M36 33h28v8H45v5h16v8H45v5h19v8H36z"/>
        </mask>
      </defs>
      <g mask="url(#${id}m)"><rect x="18.5" y="18.5" width="63" height="63" rx="15" transform="rotate(45 50 50)" fill="url(#${id})"/></g>
    </svg>`;
  }

  function setFavicon(hex) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(logoSvg(hex, { size: 64, id: 'f' }));
  }

  // aplicatie pe ecranul telefonului (PWA)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  window.WL = { ic, backend, COLORS, logoSvg, setFavicon, mix, applyAccent, esc, STATUS, MONTHS, DAYS, parseDate, fmtDate, stars, heart, poster, watchTime, splitMinutes, histogram, api };
})();
