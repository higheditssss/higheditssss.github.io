// Backend EDITSEL in browser: conturi (Firebase Auth) + date (Cloud Firestore).
// Imita rutele vechiului server (/api/...), ca paginile sa ramana aproape neschimbate.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, limit,
  writeBatch, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const IMG = 'https://image.tmdb.org/t/p/';
const STATUSES = ['watching', 'watched', 'watchlist', 'paused', 'dropped'];
const MAX_FAVS = 5;
// adrese folosite de site, nu pot fi username-uri
const RESERVED = new Set(['descopera', 'cauta', 'prieteni', 'membri', 'admin', 'cont', 'setari', 'login', 'api', 'brand', 'uploads', 'index', 'data', 'profil', 'editsel', 'despre']);

const err = (message, status = 400) => Object.assign(new Error(message), { status });
const uid6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
const today = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const str = (v, max = 5000) => (v == null ? '' : String(v).slice(0, max));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const rating = (v) => Math.max(0, Math.min(5, Math.round(num(v) * 2) / 2));
const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore nu accepta undefined

const PROFILE_DEFAULTS = {
  name: '', username: '', bio: '', avatar: '', banner: '', bannerFrom: '', statsBanner: '', statsBannerFrom: '',
  accent: '#d8d2c9', showStats: true, private: false, region: 'RO', favorites: [], following: [], declined: [], joined: '',
};

function cleanTitle(input, existing = {}) {
  const t = { ...existing };
  const pick = (k, fn) => { if (k in input) t[k] = fn(input[k]); };
  pick('type', (v) => (v === 'movie' ? 'movie' : 'tv'));
  pick('tmdbId', (v) => (v ? num(v) : null));
  pick('title', (v) => str(v, 300));
  pick('year', (v) => str(v, 4));
  pick('poster', (v) => str(v, 400000));
  pick('backdrop', (v) => str(v, 400000));
  pick('overview', (v) => str(v, 5000));
  pick('tagline', (v) => str(v, 500));
  pick('genres', (v) => (Array.isArray(v) ? v.map((g) => str(g, 60)).slice(0, 20) : []));
  pick('creators', (v) => (Array.isArray(v) ? v.map((g) => str(g, 120)).slice(0, 20) : []));
  pick('networks', (v) => (Array.isArray(v) ? v.map((g) => str(g, 120)).slice(0, 20) : []));
  pick('cast', (v) => (Array.isArray(v) ? v.slice(0, 20).map((c) => ({ name: str(c.name, 120), character: str(c.character, 200), photo: str(c.photo, 2000) })) : []));
  pick('seasons', (v) => (Array.isArray(v) ? v.slice(0, 100).map((s) => ({ number: num(s.number), name: str(s.name, 200), episodes: num(s.episodes), airDate: str(s.airDate, 10), poster: str(s.poster, 2000) })) : []));
  pick('runtime', num);
  pick('seasonsCount', num);
  pick('episodesCount', num);
  pick('showStatus', (v) => str(v, 60));
  pick('status', (v) => (STATUSES.includes(v) ? v : 'watched'));
  pick('rating', rating);
  pick('liked', Boolean);
  pick('favorite', Boolean);
  pick('review', (v) => str(v, 20000));
  pick('spoiler', Boolean);
  pick('episodesWatched', num);
  pick('seasonRatings', (v) => {
    const out = {};
    if (v && typeof v === 'object') for (const [k, r] of Object.entries(v)) if (rating(r)) out[String(num(k))] = rating(r);
    return out;
  });
  pick('note', (v) => str(v, 5000));
  pick('providers', (v) => (v && typeof v === 'object' ? v : null));
  return t;
}

function cleanDiary(input, existing = {}) {
  const e = { ...existing };
  const pick = (k, fn) => { if (k in input) e[k] = fn(input[k]); };
  pick('titleId', (v) => str(v, 40));
  pick('date', (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today()));
  pick('rating', rating);
  pick('liked', Boolean);
  pick('rewatch', Boolean);
  pick('spoiler', Boolean);
  pick('review', (v) => str(v, 20000));
  pick('season', (v) => (v === '' || v == null ? null : num(v)));
  pick('episode', (v) => (v === '' || v == null ? null : num(v)));
  return e;
}

export async function createBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const fs = getFirestore(app);

  // starea de autentificare, asteptata o data la pornire
  let user = await new Promise((resolve) => { const off = onAuthStateChanged(auth, (u) => { off(); resolve(u); }); });
  const authListeners = new Set();
  onAuthStateChanged(auth, (u) => { user = u; mine = null; authListeners.forEach((fn) => fn(u)); });

  let siteConfig = null;
  async function loadSiteConfig(force = false) {
    if (!user) return null;
    if (siteConfig && !force) return siteConfig;
    try { const s = await getDoc(doc(fs, 'site', 'config')); siteConfig = s.exists() ? s.data() : {}; } catch { siteConfig = {}; }
    return siteConfig;
  }

  // ---------- citire ----------

  async function readAll(uid) {
    const [p, titles, diary, lists] = await Promise.all([
      getDoc(doc(fs, 'users', uid)),
      getDocs(collection(fs, 'users', uid, 'titles')),
      getDocs(collection(fs, 'users', uid, 'diary')),
      getDocs(collection(fs, 'users', uid, 'lists')),
    ]);
    if (!p.exists()) return null;
    return {
      profile: { ...PROFILE_DEFAULTS, ...p.data() },
      titles: titles.docs.map((d) => ({ ...d.data(), id: d.id })),
      diary: diary.docs.map((d) => ({ ...d.data(), id: d.id })),
      lists: lists.docs.map((d) => ({ ...d.data(), id: d.id })),
    };
  }

  async function uidForUsername(username) {
    const s = await getDoc(doc(fs, 'usernames', String(username).toLowerCase()));
    return s.exists() ? s.data().uid : null;
  }

  // profil public dupa username: { profile, titles, diary, lists } | { private: true, profile } | null
  async function loadUser(username) {
    const uid = await uidForUsername(username);
    if (!uid) return null;
    return loadUserByUid(uid);
  }
  async function loadUserByUid(uid) {
    try {
      const data = await readAll(uid);
      if (data) data.uid = uid;
      return data;
    } catch (e) {
      if (e.code === 'permission-denied') {
        return { private: true, uid, profile: { name: '', avatar: '', accent: '' }, titles: [], diary: [], lists: [] };
      }
      throw e;
    }
  }

  async function listMembers() {
    const s = await getDocs(query(collection(fs, 'users'), where('private', '==', false), limit(200)));
    return s.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  // serialele si filmele populare (site/home): citite de oricine, reimprospatate de administrator la 12 ore
  async function loadHome() {
    let home = null;
    try { const s = await getDoc(doc(fs, 'site', 'home')); home = s.exists() ? s.data() : null; } catch { /* regula lipsa sau offline */ }
    const stale = !home || !home.updatedAt || !home.popularTv || Date.now() - Date.parse(home.updatedAt) > 12 * 3600 * 1000;
    if (stale && user) {
      const cfg = await loadSiteConfig();
      if (cfg && cfg.tmdbKey && cfg.adminUid === user.uid) {
        try { home = await refreshHome(); } catch (e) { console.warn('Nu am putut actualiza popularele:', e.message); }
      }
    }
    return home || { tv: [], movie: [] };
  }

  async function refreshHome() {
    const l = await lang();
    const pick = (r, type) => ({
      id: r.id, type, title: r.name || r.title || '', year: (r.first_air_date || r.release_date || '').slice(0, 4),
      poster: r.poster_path ? IMG + 'w342' + r.poster_path : '', backdrop: r.backdrop_path ? IMG + 'w1280' + r.backdrop_path : '',
      rating: Math.round((r.vote_average || 0) * 10) / 10,
    });
    // o lista TMDB (2 pagini = 40 de titluri) -> elemente mici pentru prima pagina
    const get = async (path, type) => {
      const pages = await Promise.all([1, 2].map((page) => tmdb(path, { language: l, page, region: 'RO' })));
      return pages.flatMap((p) => p.results || []).filter((r) => r.poster_path).slice(0, 40).map((r) => pick(r, type));
    };
    const [tv, movie, popularTv, popularMovie, topTv, topMovie] = await Promise.all([
      get('/trending/tv/week', 'tv'), get('/trending/movie/week', 'movie'),
      get('/tv/popular', 'tv'), get('/movie/popular', 'movie'),
      get('/tv/top_rated', 'tv'), get('/movie/top_rated', 'movie'),
    ]);
    const home = { updatedAt: new Date().toISOString(), tv, movie, popularTv, popularMovie, topTv, topMovie };
    await setDoc(doc(fs, 'site', 'home'), home);
    return home;
  }

  // pagina principala: membrii si datele celor mai activi (pentru postere si activitate)
  async function loadCommunity(n = 8) {
    const members = await listMembers();
    const active = await Promise.all(members.filter((m) => m.username).slice(0, n).map((m) => loadUserByUid(m.uid).catch(() => null)));
    return { members, active: active.filter((d) => d && !d.private) };
  }

  // ---------- datele contului logat (cache) ----------

  let mine = null;
  async function me() {
    if (!user) throw err('Neautentificat.', 401);
    if (!mine) mine = await readAll(user.uid);
    if (!mine) throw err('Profilul nu există.', 404);
    return mine;
  }
  const userDoc = () => doc(fs, 'users', user.uid);
  const sub = (col, id) => doc(fs, 'users', user.uid, col, id);
  const touch = () => updateDoc(userDoc(), { updatedAt: new Date().toISOString() }).catch(() => {});

  async function saveFavorites(favs) {
    const d = await me();
    const ids = new Set(d.titles.map((t) => t.id));
    const list = [...new Set(favs)].filter((id) => ids.has(id)).slice(0, MAX_FAVS);
    const batch = writeBatch(fs);
    batch.update(userDoc(), { favorites: list });
    for (const t of d.titles) {
      const f = list.includes(t.id);
      if (Boolean(t.favorite) !== f) { batch.update(sub('titles', t.id), { favorite: f }); t.favorite = f; }
    }
    await batch.commit();
    d.profile.favorites = list;
  }

  // ---------- conturi ----------

  function checkUsername(name) {
    const u = String(name || '').toLowerCase().trim();
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw err('Username-ul trebuie să aibă 3-30 caractere: litere mici, cifre, punct, minus sau _.');
    if (RESERVED.has(u)) throw err('Username-ul ăsta e rezervat. Alege altul.');
    return u;
  }

  async function register({ email, password, username, name }) {
    const u = checkUsername(username);
    if (await uidForUsername(u)) throw err('Username-ul e deja luat.');
    let cred;
    try { cred = await createUserWithEmailAndPassword(auth, email, password); } catch (e) { throw err(authMessage(e)); }
    const uid = cred.user.uid;
    try {
      await runTransaction(fs, async (tx) => {
        const ref = doc(fs, 'usernames', u);
        if ((await tx.get(ref)).exists()) throw err('Username-ul e deja luat.');
        tx.set(ref, { uid });
        tx.set(doc(fs, 'users', uid), clean({ ...PROFILE_DEFAULTS, uid, username: u, name: str(name, 100) || u, joined: today(), updatedAt: new Date().toISOString() }));
      });
    } catch (e) {
      await cred.user.delete().catch(() => {});
      throw e.status ? e : err('Nu am putut crea profilul: ' + e.message);
    }
    user = cred.user;
    mine = null;
    return { uid, username: u };
  }

  async function login(email, password) {
    try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { throw err(authMessage(e), 401); }
    user = auth.currentUser;
    mine = null;
  }

  function authMessage(e) {
    const map = {
      'auth/invalid-email': 'Adresa de email nu e validă.',
      'auth/email-already-in-use': 'Există deja un cont cu emailul ăsta.',
      'auth/weak-password': 'Parola trebuie să aibă minim 6 caractere.',
      'auth/invalid-credential': 'Email sau parolă greșită.',
      'auth/wrong-password': 'Email sau parolă greșită.',
      'auth/user-not-found': 'Email sau parolă greșită.',
      'auth/too-many-requests': 'Prea multe încercări. Mai încearcă peste câteva minute.',
      'auth/network-request-failed': 'Nu există conexiune la internet.',
    };
    return map[e.code] || e.message;
  }

  async function changeUsername(next) {
    const u = checkUsername(next);
    const d = await me();
    const old = d.profile.username;
    if (u === old) return;
    await runTransaction(fs, async (tx) => {
      const ref = doc(fs, 'usernames', u);
      if ((await tx.get(ref)).exists()) throw err('Username-ul e deja luat.');
      tx.set(ref, { uid: user.uid });
      if (old) tx.delete(doc(fs, 'usernames', old));
      tx.update(userDoc(), { username: u });
    });
    d.profile.username = u;
  }

  // ---------- TMDB (cheia e in site/config, setata de administratorul site-ului) ----------

  async function tmdb(path, params = {}) {
    const cfg = await loadSiteConfig();
    const key = cfg && cfg.tmdbKey;
    if (!key) throw err('Cheia TMDB nu e setată încă pe site.');
    const url = new URL('https://api.themoviedb.org/3' + path);
    const headers = { Accept: 'application/json' };
    if (key.length > 40) headers.Authorization = 'Bearer ' + key; else url.searchParams.set('api_key', key);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v);
    const r = await fetch(url, { headers });
    if (!r.ok) throw err('TMDB a răspuns ' + r.status, 502);
    return r.json();
  }
  const lang = async () => (window.EDITSEL_LANG === 'en' ? 'en-US' : ((await loadSiteConfig()) || {}).language || 'ro-RO');

  async function tmdbSearch(q, type) {
    const kind = type === 'tv' || type === 'movie' ? type : 'multi';
    const data = await tmdb('/search/' + kind, { query: q, language: await lang(), include_adult: 'false' });
    return (data.results || []).map((r) => ({ ...r, media_type: r.media_type || kind }))
      .filter((r) => r.media_type === 'tv' || r.media_type === 'movie').slice(0, 20)
      .map((r) => ({ tmdbId: r.id, type: r.media_type, title: r.name || r.title, year: (r.first_air_date || r.release_date || '').slice(0, 4), poster: r.poster_path ? IMG + 'w342' + r.poster_path : '', overview: r.overview || '' }));
  }

  async function tmdbDetails(type, id) {
    if (type !== 'tv' && type !== 'movie') throw err('Tip invalid');
    const l = await lang();
    const d = await tmdb(`/${type}/${encodeURIComponent(id)}`, { language: l, append_to_response: 'credits' });
    let { overview, tagline } = d;
    if (!overview && l !== 'en-US') {
      const en = await tmdb(`/${type}/${encodeURIComponent(id)}`, { language: 'en-US' });
      overview = en.overview; tagline = tagline || en.tagline;
    }
    const cast = ((d.credits && d.credits.cast) || []).slice(0, 12).map((c) => ({ name: c.name, character: c.character || '', photo: c.profile_path ? IMG + 'w185' + c.profile_path : '' }));
    const base = { tmdbId: d.id, type, overview: overview || '', tagline: tagline || '', genres: (d.genres || []).map((g) => g.name), poster: d.poster_path ? IMG + 'w500' + d.poster_path : '', backdrop: d.backdrop_path ? IMG + 'w1280' + d.backdrop_path : '', cast };
    if (type === 'movie') {
      return { ...base, title: d.title, year: (d.release_date || '').slice(0, 4), runtime: d.runtime || 0, creators: ((d.credits && d.credits.crew) || []).filter((c) => c.job === 'Director').map((c) => c.name) };
    }
    const seasons = (d.seasons || []).map((s) => ({ number: s.season_number, name: s.name, episodes: s.episode_count || 0, airDate: s.air_date || '', poster: s.poster_path ? IMG + 'w185' + s.poster_path : '' }));
    return {
      ...base, title: d.name, year: (d.first_air_date || '').slice(0, 4),
      runtime: (d.episode_run_time && d.episode_run_time[0]) || (d.last_episode_to_air && d.last_episode_to_air.runtime) || 45,
      seasonsCount: d.number_of_seasons || seasons.filter((s) => s.number > 0).length, episodesCount: d.number_of_episodes || 0,
      seasons, creators: (d.created_by || []).map((c) => c.name), networks: (d.networks || []).map((n) => n.name), showStatus: d.status || '',
    };
  }

  async function tmdbImages(type, id, season) {
    const seasonPath = type === 'tv' && season != null && season !== '' ? `/season/${Number(season)}` : '';
    const d = await tmdb(`/${type}/${encodeURIComponent(id)}${seasonPath}/images`, { include_image_language: 'null,en,ro' });
    const map = (list, thumb, full) => (list || []).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 80).map((i) => ({ thumb: IMG + thumb + i.file_path, url: IMG + full + i.file_path }));
    return { backdrops: map(d.backdrops, 'w300', 'w1280'), posters: map(d.posters, 'w185', 'w500') };
  }

  // platformele de streaming se salveaza pe titlu, ca vizitatorii sa le vada fara cheie TMDB
  async function tmdbProviders(t, region) {
    if (!t.tmdbId) return null;
    try {
      const d = await tmdb(`/${t.type === 'movie' ? 'movie' : 'tv'}/${t.tmdbId}/watch/providers`);
      const r = (d.results || {})[region || 'RO'];
      if (!r) return { region, none: true };
      const pick = (arr) => (arr || []).map((x) => ({ name: x.provider_name, logo: x.logo_path ? IMG + 'w92' + x.logo_path : '' }));
      return { region, link: r.link || '', flatrate: pick(r.flatrate), rent: pick(r.rent), buy: pick(r.buy), free: pick(r.free || r.ads) };
    } catch { return null; }
  }

  // ---------- rutele vechiului server ----------

  async function api(path, opts = {}) {
    const m = opts.method || 'GET';
    const b = opts.body || {};
    const url = new URL(path, location.origin);
    const p = url.pathname;
    let mm;

    if (p === '/api/admin/status') {
      const cfg = await loadSiteConfig();
      return { authed: Boolean(user), hasPassword: true, hasTmdb: Boolean(cfg && cfg.tmdbKey), isSiteAdmin: Boolean(user && cfg && (cfg.adminUid === user.uid || !cfg.adminUid)), email: user ? user.email : '' };
    }
    if (p === '/api/logout') { await signOut(auth); mine = null; return { ok: true }; }
    if (!user) throw err('Neautentificat.', 401);

    if (p === '/api/public') return clean(await me());

    if (p === '/api/settings' && m === 'GET') {
      const cfg = await loadSiteConfig(true);
      return { tmdbKey: cfg.tmdbKey ? '••••' + cfg.tmdbKey.slice(-4) : '', language: cfg.language || 'ro-RO' };
    }
    if (p === '/api/settings' && m === 'PUT') {
      if (b.newPassword) {
        if (String(b.newPassword).length < 6) throw err('Parola nouă trebuie să aibă minim 6 caractere.');
        try {
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, String(b.currentPassword || '')));
          await updatePassword(user, String(b.newPassword));
        } catch (e) { throw err(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'Parola actuală e greșită.' : authMessage(e)); }
      }
      if (b.tmdbKey !== undefined || b.language !== undefined) {
        const cfg = await loadSiteConfig(true);
        if (cfg.adminUid && cfg.adminUid !== user.uid) throw err('Doar administratorul site-ului poate schimba cheia TMDB.', 403);
        const next = { ...cfg, adminUid: user.uid };
        if (typeof b.tmdbKey === 'string' && !b.tmdbKey.startsWith('••••')) next.tmdbKey = b.tmdbKey.trim();
        if (typeof b.language === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(b.language)) next.language = b.language;
        await setDoc(doc(fs, 'site', 'config'), next);
        siteConfig = next;
      }
      return { ok: true };
    }

    if (p === '/api/profile' && m === 'PUT') {
      const d = await me();
      const pr = d.profile;
      if ('username' in b && b.username !== pr.username) await changeUsername(b.username);
      const upd = {};
      const set = (k, v) => { upd[k] = v; pr[k] = v; };
      if ('name' in b) set('name', str(b.name, 100) || pr.username);
      if ('bio' in b) set('bio', str(b.bio, 2000));
      if ('avatar' in b) set('avatar', str(b.avatar, 300000));
      if ('banner' in b) set('banner', str(b.banner, 500000));
      if ('bannerFrom' in b) set('bannerFrom', str(b.bannerFrom, 300));
      if ('statsBanner' in b) set('statsBanner', str(b.statsBanner, 500000));
      if ('statsBannerFrom' in b) set('statsBannerFrom', str(b.statsBannerFrom, 300));
      if ('joined' in b && /^\d{4}-\d{2}-\d{2}$/.test(b.joined)) set('joined', b.joined);
      if ('accent' in b && /^#[0-9a-fA-F]{6}$/.test(b.accent)) set('accent', b.accent.toLowerCase());
      if ('showStats' in b) set('showStats', Boolean(b.showStats));
      if ('private' in b) set('private', Boolean(b.private));
      if ('region' in b && /^[A-Z]{2}$/.test(b.region)) set('region', b.region);
      if ('declined' in b && Array.isArray(b.declined)) set('declined', [...new Set(b.declined.map((x) => str(x, 128)))].filter(Boolean).slice(-300));
      if ('following' in b && Array.isArray(b.following)) set('following', [...new Set(b.following.map((x) => str(x, 128)))].filter((x) => x && x !== user.uid).slice(0, 200));
      upd.updatedAt = new Date().toISOString();
      if (JSON.stringify(upd).length > 900000) throw err('Imaginile sunt prea mari. Încearcă o poză mai mică.');
      await updateDoc(userDoc(), clean(upd));
      if ('favorites' in b && Array.isArray(b.favorites)) await saveFavorites(b.favorites);
      return clean(pr);
    }

    if (p === '/api/upload' && m === 'POST') {
      if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(b.dataUrl || '')) throw err('Imagine invalidă.');
      return { url: b.dataUrl };
    }

    if (p === '/api/tmdb/search') return tmdbSearch(url.searchParams.get('q') || '', url.searchParams.get('type'));
    if (p === '/api/tmdb/details') return tmdbDetails(url.searchParams.get('type'), url.searchParams.get('id'));
    if (p === '/api/tmdb/images') return tmdbImages(url.searchParams.get('type'), url.searchParams.get('id'), url.searchParams.get('season'));

    // titluri
    if (p === '/api/titles' && m === 'POST') {
      const d = await me();
      if (b.tmdbId && d.titles.some((t) => t.tmdbId === num(b.tmdbId) && t.type === b.type)) throw err('Titlul există deja în bibliotecă.', 409);
      if (b.favorite && d.profile.favorites.length >= MAX_FAVS) throw err(`Poți avea maxim ${MAX_FAVS} favorite. Scoate unul din Setări → Seriale favorite.`);
      const now = new Date().toISOString();
      const t = cleanTitle(b, { type: 'tv', status: 'watched', rating: 0, liked: false, favorite: false, review: '', episodesWatched: 0, addedAt: now });
      if (!t.title) throw err('Titlul e obligatoriu.');
      t.id = uid6();
      t.updatedAt = now;
      t.providers = await tmdbProviders(t, d.profile.region);
      const { id, ...rest } = t;
      await setDoc(sub('titles', id), clean(rest));
      d.titles.push(t);
      if (t.favorite) await saveFavorites([...d.profile.favorites, t.id]);
      touch();
      return clean(t);
    }
    if ((mm = /^\/api\/titles\/([\w-]+)$/.exec(p))) {
      const d = await me();
      const idx = d.titles.findIndex((t) => t.id === mm[1]);
      if (idx < 0) throw err('Titlu inexistent.', 404);
      if (m === 'PUT') {
        const cur = d.titles[idx];
        if (b.favorite && !cur.favorite && d.profile.favorites.length >= MAX_FAVS) throw err(`Poți avea maxim ${MAX_FAVS} favorite. Scoate unul din Setări → Seriale favorite.`);
        const t = cleanTitle(b, cur);
        t.updatedAt = new Date().toISOString();
        if (b.tmdbId || b.seasons || !t.providers || t.providers.region !== d.profile.region) t.providers = await tmdbProviders(t, d.profile.region) || t.providers || null;
        const { id, ...rest } = t;
        await setDoc(sub('titles', id), clean(rest));
        d.titles[idx] = t;
        if ('favorite' in b && Boolean(b.favorite) !== Boolean(cur.favorite)) {
          await saveFavorites(b.favorite ? [...d.profile.favorites, t.id] : d.profile.favorites.filter((x) => x !== t.id));
        }
        touch();
        return clean(t);
      }
      if (m === 'DELETE') {
        const id = d.titles[idx].id;
        const batch = writeBatch(fs);
        batch.delete(sub('titles', id));
        d.diary.filter((e) => e.titleId === id).forEach((e) => batch.delete(sub('diary', e.id)));
        d.lists.filter((l) => l.items.includes(id)).forEach((l) => { l.items = l.items.filter((i) => i !== id); batch.update(sub('lists', l.id), { items: l.items }); });
        await batch.commit();
        d.titles.splice(idx, 1);
        d.diary = d.diary.filter((e) => e.titleId !== id);
        if (d.profile.favorites.includes(id)) await saveFavorites(d.profile.favorites.filter((x) => x !== id));
        touch();
        return { ok: true };
      }
    }

    // jurnal
    if (p === '/api/diary' && m === 'POST') {
      const d = await me();
      if (!d.titles.some((t) => t.id === b.titleId)) throw err('Titlu inexistent.');
      const e = cleanDiary(b, { date: today(), rating: 0, liked: false, rewatch: false, review: '', season: null, episode: null, createdAt: new Date().toISOString() });
      e.id = uid6();
      const { id, ...rest } = e;
      await setDoc(sub('diary', id), clean(rest));
      d.diary.push(e);
      touch();
      return clean(e);
    }
    if ((mm = /^\/api\/diary\/([\w-]+)$/.exec(p))) {
      const d = await me();
      const idx = d.diary.findIndex((e) => e.id === mm[1]);
      if (idx < 0) throw err('Intrare inexistentă.', 404);
      if (m === 'PUT') {
        const e = cleanDiary(b, d.diary[idx]);
        const { id, ...rest } = e;
        await setDoc(sub('diary', id), clean(rest));
        d.diary[idx] = e;
        touch();
        return clean(e);
      }
      if (m === 'DELETE') { await deleteDoc(sub('diary', mm[1])); d.diary.splice(idx, 1); touch(); return { ok: true }; }
    }

    // liste
    const cleanList = (input, existing, d) => {
      const l = { ...existing };
      if ('name' in input) l.name = str(input.name, 200) || 'Listă fără nume';
      if ('description' in input) l.description = str(input.description, 5000);
      if ('ranked' in input) l.ranked = Boolean(input.ranked);
      if ('items' in input) l.items = Array.isArray(input.items) ? input.items.map((i) => str(i, 40)).filter((id) => d.titles.some((t) => t.id === id)) : [];
      return l;
    };
    if (p === '/api/lists' && m === 'POST') {
      const d = await me();
      const l = cleanList(b, { name: 'Listă nouă', description: '', ranked: false, items: [], createdAt: new Date().toISOString() }, d);
      l.id = uid6();
      const { id, ...rest } = l;
      await setDoc(sub('lists', id), clean(rest));
      d.lists.push(l);
      touch();
      return clean(l);
    }
    if ((mm = /^\/api\/lists\/([\w-]+)$/.exec(p))) {
      const d = await me();
      const idx = d.lists.findIndex((l) => l.id === mm[1]);
      if (idx < 0) throw err('Listă inexistentă.', 404);
      if (m === 'PUT') {
        const l = cleanList(b, d.lists[idx], d);
        const { id, ...rest } = l;
        await setDoc(sub('lists', id), clean(rest));
        d.lists[idx] = l;
        touch();
        return clean(l);
      }
      if (m === 'DELETE') { await deleteDoc(sub('lists', mm[1])); d.lists.splice(idx, 1); touch(); return { ok: true }; }
    }

    // backup: restaurare (inlocuieste tot contul cu fisierul)
    if (p === '/api/import' && m === 'POST') {
      if (!Array.isArray(b.titles) || !Array.isArray(b.diary) || !Array.isArray(b.lists) || typeof b.profile !== 'object') throw err('Fișierul nu e un backup EDITSEL valid.');
      const d = await me();
      const ops = [];
      d.titles.forEach((t) => ops.push(['del', 'titles', t.id]));
      d.diary.forEach((e) => ops.push(['del', 'diary', e.id]));
      d.lists.forEach((l) => ops.push(['del', 'lists', l.id]));
      b.titles.forEach((t) => ops.push(['set', 'titles', str(t.id, 40) || uid6(), cleanTitle(t, { addedAt: t.addedAt || new Date().toISOString(), updatedAt: t.updatedAt || new Date().toISOString() })]));
      b.diary.forEach((e) => ops.push(['set', 'diary', str(e.id, 40) || uid6(), cleanDiary(e, { createdAt: e.createdAt || new Date().toISOString() })]));
      b.lists.forEach((l) => ops.push(['set', 'lists', str(l.id, 40) || uid6(), { name: str(l.name, 200), description: str(l.description, 5000), ranked: Boolean(l.ranked), items: Array.isArray(l.items) ? l.items.map((x) => str(x, 40)) : [], createdAt: l.createdAt || new Date().toISOString() }]));
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(fs);
        for (const [op, col, id, data] of ops.slice(i, i + 400)) {
          if (op === 'del') batch.delete(sub(col, id)); else { const { id: _drop, ...rest } = data; batch.set(sub(col, id), clean(rest)); }
        }
        await batch.commit();
      }
      const pr = b.profile;
      const keep = ['name', 'bio', 'avatar', 'banner', 'bannerFrom', 'statsBanner', 'statsBannerFrom', 'accent', 'showStats', 'private', 'region', 'joined'];
      const upd = {};
      for (const k of keep) if (k in pr && pr[k] != null && !(typeof pr[k] === 'string' && pr[k].startsWith('/uploads/'))) upd[k] = pr[k];
      upd.favorites = Array.isArray(pr.favorites) ? pr.favorites.slice(0, MAX_FAVS) : b.titles.filter((t) => t.favorite).map((t) => t.id).slice(0, MAX_FAVS);
      upd.updatedAt = new Date().toISOString();
      await updateDoc(userDoc(), clean(upd));
      mine = null;
      return { ok: true };
    }

    throw err('Rută inexistentă: ' + p, 404);
  }

  return {
    get user() { return user; },
    onAuth: (fn) => { authListeners.add(fn); return () => authListeners.delete(fn); },
    api, register, login, logout: () => signOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email).catch((e) => { throw err(authMessage(e)); }),
    loadUser, loadUserByUid, listMembers, loadCommunity, loadHome, uidForUsername,
    myUsername: async () => (user ? (await me()).profile.username : null),
    exportMine: async () => clean(await me()),
  };
}

// porneste backend-ul si rezolva promisiunea asteptata de app.js / admin.js
(async () => {
  const resolve = window.__resolveBackend || (() => {});
  const cfg = window.EDITSEL_FIREBASE;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).startsWith('PUNE')) {
    resolve({ missingConfig: true });
    return;
  }
  try { resolve(await createBackend(cfg)); } catch (e) { console.error(e); resolve({ error: e }); }
})();
