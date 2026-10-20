// Utilitare comune pentru pagina publica si admin.
(function () {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const STATUS = {
    watching: { label: 'Mă uit acum', short: 'În curs', icon: '▶' },
    watched: { label: 'Văzut', short: 'Văzute', icon: '👁' },
    watchlist: { label: 'De văzut', short: 'De văzut', icon: '🕒' },
    paused: { label: 'Pe pauză', short: 'Pauză', icon: '⏸' },
    dropped: { label: 'Abandonat', short: 'Abandonate', icon: '🗑' },
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
      html += `<span class="star ${cls}">★</span>`;
    }
    return html + '</span>';
  }

  const heart = (on) => (on ? '<span class="heart" title="Îmi place">♥</span>' : '');

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
      <span class="hist-label">★</span>
      <div class="hist-bars">${buckets.map((c, i) => `<div class="hist-bar" style="height:${Math.max(c ? 6 : 2, (c / max) * 100)}%" title="${(i + 1) / 2} ★ — ${c}"></div>`).join('')}</div>
      <span class="hist-label">★★★★★</span>
    </div>`;
  }

  async function api(path, opts = {}) {
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
    ['Albastru regal', '#5b7cfa'],
    ['Auriu', '#f4b942'],
    ['Portocaliu apus', '#ff5a1f'],
    ['Coral', '#ff7f50'],
    ['Roșu cinema', '#e5374b'],
    ['Vișiniu', '#9b1c2e'],
    ['Roz', '#ff69b4'],
    ['Prună', '#dda0dd'],
    ['Mov', '#7c4dff'],
    ['Turcoaz', '#1fb5a5'],
    ['Verde neon', '#8ace00'],
    ['Verde vânător', '#3f7a4a'],
    ['Alb crem', '#d8d2c9'],
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
  }

  window.WL = { COLORS, applyAccent, esc, STATUS, MONTHS, DAYS, parseDate, fmtDate, stars, heart, poster, watchTime, splitMinutes, histogram, api };
})();
