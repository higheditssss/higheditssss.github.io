// EDITSEL in engleza: traduce textul interfetei direct in pagina (romana ramane limba de baza).
// Se traduc doar texte cunoscute (dictionar + tipare); continutul membrilor (titluri, recenzii, bio) ramane cum e.
(function () {
  const KEY = 'editsel_lang';
  let lang = 'ro';
  try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'ro'; } catch { /* fara memorie locala */ }

  const D = {
    // meniu, antet, subsol
    'Acasă': 'Home', 'Descoperă': 'Discover', 'Membri': 'Members', 'Prieteni': 'Friends', 'Caută': 'Search', 'Cont': 'Account',
    'Profil': 'Profile', 'Profilul meu': 'My profile', 'Profilul meu ↗': 'My profile ↗', 'Setări': 'Settings', 'setări': 'settings',
    'Intră': 'Log in', 'Ieșire': 'Log out', 'Creează cont': 'Sign up', 'Creează cont gratuit': 'Create a free account', 'Am deja cont': 'I already have an account',
    '＋ Jurnal': '＋ Log', 'Notificări': 'Notifications', 'Nu ai notificări.': 'No notifications.', 'Toți prietenii ›': 'All friends ›',
    'Explorează': 'Explore', 'Contul tău': 'Your account', 'Căutare': 'Search', 'Surse': 'Sources', 'Sus ↑': 'Top ↑', 'Navigare': 'Navigation',
    'Jurnal de seriale și filme': 'A diary for TV shows and movies', 'Jurnal de seriale și filme.': 'A diary for TV shows and movies.',
    'Jurnalul tău de seriale și filme. Notează ce vezi, dă note, scrie recenzii și vezi ce urmăresc prietenii tăi.': 'Your TV and movie diary. Log what you watch, rate, write reviews and see what your friends are watching.',
    'Postere, descrieri, sezoane și actori': 'Posters, overviews, seasons and cast', 'Unde poți viziona': 'Where to watch',
    'Acest site folosește API-ul TMDB, dar nu este aprobat sau certificat de TMDB.': 'This site uses the TMDB API but is not endorsed or certified by TMDB.',
    'Caută seriale, filme, membri…': 'Search shows, movies, members…', 'Despre datele de pe site': 'About the data on this site',
    'EDITSEL folosește': 'EDITSEL uses', 'API-ul TMDB': 'the TMDB API',
    '(The Movie Database) pentru postere, imagini, descrieri, sezoane și actori, iar pentru platformele de streaming folosește date de la JustWatch.': '(The Movie Database) for posters, images, overviews, seasons and cast, and JustWatch data for streaming platforms.',
    'Acest site folosește API-ul TMDB, dar nu este aprobat sau certificat de TMDB. Ratingurile, recenziile și jurnalele sunt ale membrilor.': 'This site uses the TMDB API but is not endorsed or certified by TMDB. Ratings, reviews and diaries belong to the members.',
    'Am înțeles': 'Got it',

    // pagina principala
    'Toate filmele și serialele tale.': 'All your movies and shows.', 'Într-un singur loc.': 'In one place.',
    'Notează ce vezi, dă note, scrie recenzii, fă-ți liste și vezi ce urmăresc prietenii tăi. Gratuit, fără reclame.': 'Log what you watch, rate, write reviews, make lists and see what your friends are watching. Free, no ads.',
    'membru': 'member', 'membri': 'members', 'Jurnal': 'Diary', 'Note și recenzii': 'Ratings & reviews', 'Liste': 'Lists',
    'Notează fiecare episod și film văzut, cu dată, notă și apreciere. Totul ordonat pe luni.': 'Log every episode and movie you watch, with date, rating and like. All sorted by month.',
    'Stele cu jumătăți, recenzii cu spoilere ascunse și note pe fiecare sezon.': 'Half-star ratings, reviews with hidden spoilers and per-season ratings.',
    'Topuri, colecții, „de văzut în weekend” — liste numerotate sau simple.': 'Rankings, collections, “weekend watchlist” — ranked or simple lists.',
    'Adaugă-ți prietenii și vezi ce au văzut și cât de mult le-a plăcut.': 'Add your friends and see what they watched and how much they liked it.',
    'Seriale populare acum': 'Popular shows right now', 'Filme populare acum': 'Popular movies right now', 'Activitate recentă': 'Recent activity',
    'Începe-ți jurnalul azi.': 'Start your diary today.', 'Gratuit, fără reclame. Durează un minut.': 'Free, no ads. Takes a minute.',
    'Încă nu e nicio activitate. Fii primul care notează ce a văzut!': 'No activity yet. Be the first to log something!',
    'Încă nu s-a înscris nimeni. Fii primul!': 'Nobody has signed up yet. Be the first!', 'Încă nu s-a înscris nimeni.': 'Nobody has signed up yet.', 'membru nou': 'new member',

    // descopera / cautare / membri / prieteni
    'Ce se vede acum. Click pe un poster ca să-l adaugi în jurnal.': 'What people are watching. Click a poster to add it to your diary.',
    'Seriale populare': 'Popular shows', 'Seriale în trend': 'Trending shows', 'Filme populare': 'Popular movies', 'Filme în trend': 'Trending movies',
    'Cele mai apreciate seriale': 'Top rated shows', 'Cele mai apreciate filme': 'Top rated movies', 'Vezi tot ›': 'See all ›', '‹ Descoperă': '‹ Discover', 'Serialul zilei ·': 'Show of the day ·',
    'Activitatea prietenilor': "Friends' activity", '＋ Adaugă': '＋ Add', '✓ În biblioteca ta': '✓ In your library', 'În biblioteca ta': 'In your library', 'în biblioteca ta': 'in your library',
    'Listele se încarcă după ce administratorul site-ului intră o dată (are nevoie de cheia TMDB).': 'Lists load after the site admin logs in once (needs the TMDB key).',
    'Fă-ți cont ca să-ți adaugi prietenii.': 'Create an account to add your friends.', 'Prietenii tăi n-au notat nimic încă.': "Your friends haven't logged anything yet.",
    'Seriale și filme': 'Shows & movies', 'Seriale': 'TV shows', 'Filme': 'Movies', 'Caut…': 'Searching…', 'Nu am găsit nimic.': 'Nothing found.',
    'Fă-ți cont': 'Create an account', 'ca să cauți orice serial sau film și să-l adaugi în jurnal.': 'to search any show or movie and add it to your diary.',
    'ca să cauți în toate serialele și filmele.': 'to search all shows and movies.', 'Editează': 'Edit',
    'Toți cei care își țin jurnalul pe EDITSEL.': 'Everyone keeping a diary on EDITSEL.', 'Caută după nume sau username…': 'Search by name or username…',
    'Niciun membru găsit.': 'No members found.', 'tu': 'you',
    'Trimite cereri de prietenie. Când celălalt acceptă, vă vedeți unul altuia activitatea.': 'Send friend requests. Once accepted, you see each other’s activity.',
    'Cereri de prietenie': 'Friend requests', 'Prietenii tăi': 'Your friends', 'Cereri trimise': 'Sent requests', 'Sugestii': 'Suggestions', 'Rezultate': 'Results',
    'Nu ai prieteni încă. Trimite o cerere cuiva de mai jos.': 'No friends yet. Send someone a request below.',
    'Nu mai sunt alți membri. Trimite-le prietenilor link-ul site-ului!': 'No other members yet. Send your friends the link!',
    '+ Adaugă prieten': '+ Add friend', '✓ Acceptă': '✓ Accept', '✓ Acceptă cererea': '✓ Accept request', 'Refuză': 'Decline', '✓ Prieteni': '✓ Friends',
    'Anulează cererea': 'Cancel request', 'Cerere trimisă · Anulează': 'Request sent · Cancel', 'ți-a trimis o cerere de prietenie.': 'sent you a friend request.',
    'Tu și': 'You and', 'sunteți acum prieteni.': 'are now friends.', '✎ Editează profilul': '✎ Edit profile',
    'Nu ai prieteni încă. Trimite cereri de pe pagina': 'No friends yet. Send requests from the', 'sau': 'or', 'intră în cont': 'log in',
    'ca să-ți adaugi prietenii și să vezi ce au văzut.': 'to add your friends and see what they watched.',

    // profil
    'Aprecieri': 'Likes', 'Recenzii': 'Reviews', 'Statistici': 'Stats', 'Favorite': 'Favorites', 'Mă uit acum': 'Watching', 'Recenzii recente': 'Recent reviews',
    'Timp petrecut la seriale': 'Time spent on TV', 'luni · zile · ore': 'months · days · hours', 'Episoade văzute': 'Episodes watched', 'Petrecute la filme': 'Spent on movies',
    'Văzute': 'Watched', 'De văzut': 'Watchlist', 'Ratinguri': 'Ratings', 'Toate statisticile': 'All stats', 'Vezi prietenii ›': 'See friends ›',
    'Nimic în curs acum.': 'Nothing in progress.', 'Încă nu e nimic aici.': 'Nothing here yet.', 'Nicio recenzie încă.': 'No reviews yet.',
    'Niciun titlu apreciat încă.': 'No liked titles yet.', 'Jurnalul e gol.': 'The diary is empty.', 'Nicio listă încă.': 'No lists yet.',
    'Lista nu există.': "This list doesn't exist.", 'Lista e goală.': 'The list is empty.', '‹ Toate listele': '‹ All lists', '· listă clasament': '· ranked list',
    'Nu are prieteni încă.': 'No friends yet.', 'Profil inexistent': "Profile doesn't exist", 'Nu am putut încărca profilul': "Couldn't load the profile",
    '‹ Pagina principală': '‹ Home', '🔒 Profilul ăsta este privat.': '🔒 This profile is private.', 'Profil privat': 'Private profile',
    'Site-ul nu e conectat încă': "The site isn't connected yet",
    'Toate': 'All', 'În curs': 'Watching', 'Pauză': 'Paused', 'Abandonate': 'Dropped', 'Sortează după': 'Sort by',
    'Adăugate recent': 'Recently added', 'Actualizate recent': 'Recently updated', 'Rating (mare → mic)': 'Rating (high → low)', 'Titlu (A → Z)': 'Title (A → Z)', 'An apariție (nou → vechi)': 'Release year (new → old)',
    'seriale': 'shows', 'sezoane': 'seasons', 'episoade': 'episodes', 'filme': 'movies', 'văzute': 'watched', 'ore': 'hours',
    'Niciun serial aici.': 'No shows here.', 'Niciun film aici.': 'No movies here.', 'Doar seriale': 'Shows only', 'Doar filme': 'Movies only',
    'Serial': 'TV show', 'Film': 'Movie', 'Revăzut': 'Rewatched', 'Are recenzie': 'Has a review', '↻ revăzut': '↻ rewatched', 'spoiler — click ca să vezi': 'spoiler — click to reveal',
    'Seriale': 'TV shows', 'Intrări în jurnal': 'Diary entries', 'Rating mediu': 'Average rating', 'La filme': 'On movies', 'Distribuția ratingurilor': 'Rating distribution',
    'Activitate (ultimele 12 luni)': 'Activity (last 12 months)', 'Genuri preferate': 'Favorite genres', 'Pe decenii': 'By decade', 'Cele mai bine notate': 'Highest rated',
    'Încă nu ai dat note.': 'No ratings yet.', 'Nu sunt date încă.': 'No data yet.',
    'Activitatea mea': 'My activity', 'Status': 'Status', 'Rating': 'Rating', 'Marcaje': 'Marks', 'Episoade': 'Episodes', 'Adăugat': 'Added', 'Notiță': 'Note',
    '♥ Îmi place': '♥ I like it', '★ Favorit': '★ Favorite', 'Îmi place': 'I like it', 'Favorit': 'Favorite', 'Creat de': 'Created by', 'Regia': 'Directed by',
    'Apare în liste': 'Appears in lists', 'Recenzia mea': 'My review', 'Din jurnal': 'From the diary', 'Distribuție': 'Cast', 'Nimic în plus de afișat.': 'Nothing more to show.',
    'Abonament': 'Subscription', 'Gratuit': 'Free', 'Închiriere': 'Rent', 'Cumpărare': 'Buy', 'Sursa: JustWatch prin TMDB': 'Source: JustWatch via TMDB', 'Detalii ›': 'Details ›',
    'Văzut': 'Watched', 'Pe pauză': 'Paused', 'Abandonat': 'Dropped', 'Limba': 'Language',

    // pop-up adaugare
    'Notă': 'Rating', 'Îți place?': 'Like it?', 'Recenzie (opțional)': 'Review (optional)', 'Ce părere ai?': 'What did you think?', 'Conține spoilere': 'Contains spoilers',
    'Adaugă în jurnal': 'Add to diary', 'Data': 'Date', 'Sezon': 'Season', 'Episod': 'Episode', 'Mai multe opțiuni ▾': 'More options ▾', 'Mai puține opțiuni ▴': 'Fewer options ▴',
    'Anulează': 'Cancel', 'Adaugă': 'Add', 'Salvează': 'Save', 'Salvat': 'Saved', 'Se încarcă…': 'Loading…', 'Note pe sezoane': 'Season ratings', 
    'Notiță (apare pe pagina titlului)': 'Note (shown on the title page)', 'Imagini': 'Images', 'Alege alt poster': 'Pick another poster', 'Alege alt fundal': 'Pick another backdrop',
    'Se încarcă imaginile…': 'Loading images…', 'Nu există alte imagini.': 'No other images.', 'Poster ales. Apasă Salvează.': 'Poster picked. Press Save.', 'Fundal ales. Apasă Salvează.': 'Backdrop picked. Press Save.',

    // setari (admin)
    'Adaugă serial sau film': 'Add a show or movie', 'Adaugă manual': 'Add manually', 'Caută un titlu… (ex: Dexter)': 'Search a title… (e.g. Dexter)',
    'Bibliotecă': 'Library', 'Filtrează…': 'Filter…', 'Toate tipurile': 'All types', 'Toate statusurile': 'All statuses', 'Titlu': 'Title', 'Tip': 'Type',
    'Nimic aici. Adaugă din secțiunea „Adaugă”.': 'Nothing here. Add from the “Add” section.', 'Status actualizat': 'Status updated',
    '＋ Intrare nouă': '＋ New entry', 'Intrare nouă în jurnal': 'New diary entry', 'Editează intrarea': 'Edit entry', 'Ștergi intrarea din jurnal?': 'Delete this diary entry?',
    'Sezon (opțional)': 'Season (optional)', 'Episod (opțional)': 'Episode (optional)', 'Recenzie': 'Review', 'Conține spoilere (se afișează blurat)': 'Contains spoilers (shown blurred)',
    'Șterge': 'Delete', 'Șters': 'Deleted', '＋ Listă nouă': '＋ New list', 'Listă nouă': 'New list', 'Editează lista': 'Edit list', 'Nume': 'Name', 'Descriere': 'Description',
    'Listă clasament (numerotată)': 'Ranked list (numbered)', 'Titluri în listă': 'Titles in list', 'Adaugă din bibliotecă': 'Add from library', 'Caută în bibliotecă…': 'Search library…',
    'Șterge lista': 'Delete list', 'Lista a fost ștearsă': 'List deleted', 'Dă-i un nume listei.': 'Give the list a name.', 'Nimic.': 'Nothing.', 'ex: Cele mai bune seriale crime': 'e.g. Best crime shows',
    'Profil': 'Profile', 'Nume, bio și poză': 'Name, bio & picture', 'Seriale favorite': 'Favorite shows', 'Culoare': 'Color', 'Confidențialitate': 'Privacy',
    'Postere și bannere': 'Posters & banners', 'Banner profil': 'Profile banner', 'Banner statistici': 'Stats banner', 'Postere personalizate': 'Custom posters',
    'Postere sezoane personalizate': 'Custom season posters', 'Bannere seriale personalizate': 'Custom show banners', 'Logo și iconițe': 'Logo & icons',
    'Date': 'Data', 'Marchează ca văzut': 'Mark watched', 'Adaugă la de văzut': 'Add to watchlist', 'În lista de văzut': 'In your watchlist', 'Pune pe pauză': 'Pause',
    'Abandonează': 'Drop', 'Notă, recenzie, jurnal': 'Rating, review, log', 'Scoate din bibliotecă': 'Remove from library',
    'Nota ta': 'Your rating', 'Episoade văzute': 'Episodes watched', 'Toate': 'All', 'Recenzia ta': 'Your review', 'Nota salvată': 'Rating saved',
    'Fă-ți cont': 'Sign up', 'Minus un episod': 'One episode less', 'Plus un episod': 'One more episode', 'Seriale, filme sau membri': 'Shows, movies or members', 'Adaugă un serial': 'Add a show', 'Jurnalul meu': 'My diary', 'Scoate titlul din bibliotecă': 'Remove the title from your library', 'Adaugă seriale': 'Add shows', 'Pune EDITSEL pe ecranul telefonului': 'Put EDITSEL on your home screen', 'Instalează aplicația EDITSEL': 'Install the EDITSEL app', 'Adaugă pe ecran': 'Add to Home Screen', '→ „Adaugă pe ecranul principal”': '→ “Add to Home Screen”', 'Se deschide ca o aplicație, fără bara browserului.': 'Opens like an app, without the browser bar.',
    'Instalează': 'Install', 'Închide': 'Close', 'Partajează, apoi „Adaugă pe ecranul principal”.': 'Share, then “Add to Home Screen”.', 'Apasă': 'Tap', 'Caută orice serial sau film': 'Search any show or movie', 'Scrie un titlu mai sus și alege-l din rezultate.': 'Type a title above and pick it from the results.',
    'Adaugă din secțiunea „Adaugă”.': 'Add some from the “Add” section.', 'Nimic aici.': 'Nothing here.', 'Adaugă o intrare cu butonul de sus.': 'Add an entry with the button above.',
    'apreciate': 'liked', 'recenzii': 'reviews', 'intrări': 'entries', 'titluri': 'titles', 'seriale': 'shows', 'filme': 'movies', 'favorite': 'favorites', '↻ Revăzut': '↻ Rewatch', 'Intrare nouă': 'New entry', 'Cum te văd ceilalți': 'How others see you', 'Până la 5, sus pe profil': 'Up to 5, top of your profile', 'Culoarea profilului tău': 'Your profile color',
    'Profil public sau privat': 'Public or private profile', 'Cereri și prieteni': 'Requests and friends', 'Imaginea mare de sus': 'The big image on top', 'Fundalul paginii Statistici': 'Background of the Stats page',
    'Alt poster pentru un titlu': 'Another poster for a title', 'Poster pentru un sezon': 'A poster for one season', 'Fundalul paginii unui titlu': 'Background of a title page', 'Logo-ul în culoarea ta': 'The logo in your color',
    'Lipești o listă de titluri': 'Paste a list of titles', 'Descarcă sau pune înapoi tot': 'Download or restore everything', 'Cheia TMDB a site-ului': "The site's TMDB key",
    'Țara pentru platforme': 'Country for streaming services', 'Schimbă parola contului': 'Change your password', 'Vezi profilul': 'View profile', 'Import din listă': 'Import from list', 'Backup și restaurare': 'Backup & restore', 'TMDB și limbă (administrator)': 'TMDB & language (admin)',
    'Locație (unde poți viziona)': 'Location (where to watch)', 'Parolă': 'Password', '‹ Înapoi la setări': '‹ Back to settings',
    'Nume afișat': 'Display name', 'Username (apare ca @username)': 'Username (shown as @username)', 'Membru din': 'Member since', 'Bio': 'Bio', 'Poză de profil': 'Profile picture',
    'URL imagine': 'Image URL', 'Încarcă': 'Upload', 'Încarcă poză': 'Upload picture', 'Imagine încărcată': 'Image uploaded',
    'Alege până la 5 titluri. Apar în această ordine pe profil.': 'Pick up to 5 titles. They appear in this order on your profile.', 'Favorite salvate': 'Favorites saved',
    'Culoarea se aplică pe tot site-ul: butoane, stele, tab-uri, grafice.': 'The color applies everywhere: buttons, stars, tabs, charts.', 'Sau orice culoare': 'Or any color',
    'Folosește culoarea': 'Use this color', 'Culoare schimbată': 'Color changed',
    'Vizitatorii văd doar numele și poza. Tu (logat în admin) vezi tot.': 'Visitors only see your name and picture. You (logged in) see everything.',
    'Arată statisticile pe profil': 'Show stats on profile', 'Timpul petrecut, graficul de rating și tab-ul Statistici.': 'Time spent, rating chart and the Stats tab.',
    'Profilul e privat': 'Profile is private', 'Profilul e public': 'Profile is public',
    'Apare sus pe profilul tău.': 'Shown at the top of your profile.', 'Alege un serial ca să vezi toate imaginile lui de fundal.': 'Pick a show to see all of its backdrops.',
    'Alege serialul': 'Pick a show', 'Automat': 'Automatic', 'Imagine proprie': 'Custom image', 'Banner schimbat': 'Banner changed', 'Banner automat': 'Automatic banner',
    'Serial selectat:': 'Selected show:', 'Alege posterul': 'Pick a poster', 'Alege fundalul': 'Pick a backdrop', 'Alege bannerul': 'Pick a banner', '‹ Alt titlu': '‹ Another title',
    'Caută un serial sau film…': 'Search a show or movie…', 'Caută un serial sau film mai sus.': 'Search a show or movie above.', 'Din biblioteca ta': 'From your library',
    'Încarc imaginile…': 'Loading images…', 'Titlul ăsta nu are imagini.': 'This title has no images.', 'Poster schimbat': 'Poster changed', 'Poster de sezon schimbat': 'Season poster changed',
    'Niciun titlu din TMDB în bibliotecă.': 'No TMDB titles in your library.', 'Alege alt poster pentru un serial sau film. Apare peste tot pe site.': 'Pick another poster for a show or movie. It shows everywhere on the site.',
    'Alege alt fundal (banner) pentru pagina unui serial sau film.': 'Pick another backdrop (banner) for a title page.', 'Alege alt poster pentru un sezon anume.': 'Pick another poster for a specific season.',
    'Logo-ul EDITSEL în toate culorile. Pe site, favicon-ul, iconița de pe telefon și imaginea de share se schimbă automat după culoarea profilului.': 'The EDITSEL logo in every color. The favicon, phone icon and share image follow your profile color automatically.',
    'Logo mare': 'Large logo', 'Logo mare (fundal deschis)': 'Large logo (light background)', 'Iconiță / poză de profil': 'Icon / profile picture', 'Imagine pentru share': 'Share image',
    'Semnul singur': 'Mark only', 'Iconiță ecran de start': 'Home screen icon', '⇩ Descarcă': '⇩ Download',
    'Importă': 'Import', 'Detectează automat': 'Detect automatically', 'Descarcă tot': 'Download everything', 'Un fișier JSON cu profilul, titlurile, jurnalul și listele.': 'A JSON file with your profile, titles, diary and lists.',
    '⇩ Descarcă backup': '⇩ Download backup', 'Restaurează din backup': 'Restore from backup', '⇧ Alege fișierul': '⇧ Choose file', 'Backup restaurat': 'Backup restored',
    'Înlocuiește toate datele actuale. Descarcă întâi un backup, dacă vrei să păstrezi datele actuale.': 'Replaces all current data. Download a backup first if you want to keep it.',
    'Limba descrierilor': 'Description language', 'lipește cheia aici': 'paste the key here', 'Cheie API TMDB (v3) sau token de citire (v4)': 'TMDB API key (v3) or read token (v4)',
    'Țara': 'Country', 'Țară salvată': 'Country saved', 'Parola actuală': 'Current password', 'Parolă nouă': 'New password', 'Confirmă': 'Confirm', 'Schimbă parola': 'Change password',
    'Parolă schimbată': 'Password changed', 'Parolele nu coincid.': "Passwords don't match.",
    'Pe pagina fiecărui titlu apare „Unde poți viziona” (Netflix, HBO Max, Disney+ etc.) pentru țara aleasă.': 'Each title page shows “Where to watch” (Netflix, HBO Max, Disney+ etc.) for the chosen country.',
    'Prietenii se adaugă prin cereri de prietenie: trimiți o cerere, iar când celălalt o acceptă deveniți prieteni și vă vedeți activitatea.': 'Friends are added through requests: send one, and once accepted you become friends and see each other’s activity.',
    '☺ Deschide pagina Prieteni': '☺ Open the Friends page', 'Editează profilul': 'Edit profile',
    'Detalii titlu': 'Title details', 'Durată (min)': 'Runtime (min)', 'Durată episod (min)': 'Episode runtime (min)', 'Nr. sezoane': 'Seasons', 'Nr. episoade': 'Episodes',
    'Genuri (separate prin virgulă)': 'Genres (comma separated)', 'Poster (URL)': 'Poster (URL)', 'Imagine fundal (URL)': 'Backdrop image (URL)', 'Alege': 'Pick',
    '↻ Actualizează din TMDB': '↻ Refresh from TMDB', 'Actualizat din TMDB': 'Refreshed from TMDB', 'Titlu nou': 'New title', 'An': 'Year',
    'Folosit pentru timpul petrecut. La status „Văzut” cu 0, se socotesc toate episoadele.': 'Used for time spent. With status “Watched” and 0, all episodes count.',
    '(cu ratingul și aprecierea de mai sus)': '(with the rating and like above)', '(de la TMDB, le poți modifica)': '(from TMDB, you can edit them)',
    'Pentru toate imaginile unui serial ai nevoie de cheia TMDB (Setări). Până atunci poți alege din imaginile titlurilor tale:': 'You need the TMDB key (Settings) for all images. Until then you can pick from your titles:',
    'Căutarea automată nu e pornită încă pe site (administratorul trebuie să pună cheia TMDB). Până atunci poți adăuga manual.': "Automatic search isn't enabled yet (the admin must add the TMDB key). Until then you can add manually.",
    'Gratuit. Primești profilul tău de seriale și filme.': 'Free. You get your own TV and movie profile.', 'Bine ai revenit!': 'Welcome back!', 'Intră în cont': 'Log in',
    'Creează cont nou': 'Create a new account', 'Am uitat parola': 'Forgot password', 'Email': 'Email', 'ex: Ionuț': 'e.g. John', 'ex: ionutzz': 'e.g. johnny',
    'Cont creat. Bun venit!': 'Account created. Welcome!', 'Ți-am trimis pe email un link pentru parolă nouă.': 'We emailed you a password reset link.', 'Emailul contului:': 'Account email:',

    // mesaje de eroare
    'Email sau parolă greșită.': 'Wrong email or password.', 'Adresa de email nu e validă.': 'Invalid email address.', 'Există deja un cont cu emailul ăsta.': 'An account with this email already exists.',
    'Parola trebuie să aibă minim 6 caractere.': 'Password must have at least 6 characters.', 'Parola nouă trebuie să aibă minim 6 caractere.': 'The new password must have at least 6 characters.',
    'Parola actuală e greșită.': 'Current password is wrong.', 'Prea multe încercări. Mai încearcă peste câteva minute.': 'Too many attempts. Try again in a few minutes.',
    'Nu există conexiune la internet.': 'No internet connection.', 'Username-ul e deja luat.': 'Username is already taken.', 'Username-ul ăsta e rezervat. Alege altul.': 'This username is reserved. Pick another.',
    'Username-ul trebuie să aibă 3-30 caractere: litere mici, cifre, punct, minus sau _.': 'Username must be 3-30 characters: lowercase letters, digits, dot, dash or _.',
    'Titlul e obligatoriu.': 'Title is required.', 'Titlul există deja în bibliotecă.': 'This title is already in your library.', 'Cheia TMDB nu e setată încă pe site.': "The TMDB key isn't set yet.",
    'Imaginile sunt prea mari. Încearcă o poză mai mică.': 'Images are too large. Try a smaller picture.', 'Fișierul nu e JSON valid.': "The file isn't valid JSON.",
    'Fișierul nu e un backup EDITSEL valid.': "The file isn't a valid EDITSEL backup.", 'Neautentificat.': 'Not logged in.', 'Doar administratorul site-ului poate schimba cheia TMDB.': 'Only the site admin can change the TMDB key.',

    // culori, tari, zile
    'Alb crem': 'Cream white', 'Mov': 'Purple', 'Albastru regal': 'Royal blue', 'Auriu': 'Gold', 'Portocaliu apus': 'Sunset orange', 'Coral': 'Coral', 'Roșu cinema': 'Cinema red',
    'Vișiniu': 'Maroon', 'Roz': 'Pink', 'Prună': 'Plum', 'Turcoaz': 'Turquoise', 'Verde neon': 'Neon green', 'Verde vânător': 'Hunter green',
    'Alb perlat': 'Pearl white', 'Argintiu': 'Silver', 'Gri ardezie': 'Slate gray', 'Negru onix': 'Onyx black', 'Bej nisip': 'Sand beige',
    'Cafeniu': 'Brown', 'Cupru': 'Copper', 'Piersică': 'Peach', 'Galben lămâie': 'Lemon yellow', 'Roșu rubin': 'Ruby red',
    'Zmeură': 'Raspberry', 'Roz pudrat': 'Powder pink', 'Lavandă': 'Lavender', 'Indigo': 'Indigo', 'Albastru petrol': 'Petrol blue',
    'Albastru gheață': 'Ice blue', 'Verde mentă': 'Mint green', 'Verde smarald': 'Emerald green', 'Verde salvie': 'Sage green',
    'România': 'Romania', 'SUA': 'USA', 'Marea Britanie': 'United Kingdom', 'Germania': 'Germany', 'Italia': 'Italy', 'Spania': 'Spain', 'Franța': 'France', 'Olanda': 'Netherlands', 'Ungaria': 'Hungary', 'Română': 'Romanian',
    'DUM': 'SUN', 'LUN': 'MON', 'MAR': 'TUE', 'MIE': 'WED', 'JOI': 'THU', 'VIN': 'FRI', 'SÂM': 'SAT',
    'Duminică': 'Sunday', 'Luni': 'Monday', 'Marți': 'Tuesday', 'Miercuri': 'Wednesday', 'Joi': 'Thursday', 'Vineri': 'Friday', 'Sâmbătă': 'Saturday',

    // trailer
    'Trailer': 'Trailer', 'Închide': 'Close', 'Caută pe YouTube': 'Search on YouTube', 'Nu am găsit un trailer pe TMDB pentru titlul ăsta.': "We couldn't find a trailer on TMDB for this title.",

    // calendar
    'Calendar': 'Calendar', 'Reîmprospătează': 'Refresh', 'Episoadele noi din serialele tale, zi cu zi.': 'New episodes from your shows, day by day.',
    'Azi': 'Today', 'Mâine': 'Tomorrow', 'Au apărut recent': 'Recently aired', 'Mai târziu': 'Later', 'azi': 'today',
    'în următoarele 7 zile': 'in the next 7 days', 'apărute săptămâna trecută': 'aired last week',
    'Serial nou': 'New show', 'Sezon nou': 'New season', 'Final de sezon': 'Season finale', 'Nimic programat în următoarele două luni.': 'Nothing scheduled in the next two months.',
    'Niciun episod nou în următoarele două luni. Marchează serialele pe care le urmărești cu „Mă uit acum” sau „De văzut” și apar aici.': 'No new episodes in the next two months. Mark the shows you follow as “Watching” or “Watchlist” and they show up here.',
    'Datele sunt de pe TMDB, pentru serialele din biblioteca ta (fără cele abandonate). Se actualizează la câteva ore.': 'Data from TMDB, for the shows in your library (except dropped ones). Refreshed every few hours.',
    'ca să vezi când apar episoadele noi din serialele tale.': 'to see when new episodes of your shows come out.',

    // recenzie
    'Scrie o recenzie': 'Write a review', 'Editează recenzia': 'Edit review', 'Recenzia': 'Review', 'Publică recenzia': 'Publish review',
    'Șterge recenzia': 'Delete review', 'Ștergi recenzia?': 'Delete your review?', 'Recenzia a fost publicată': 'Review published',
    'Recenzia a fost ștearsă': 'Review deleted', 'Scrie ceva în recenzie.': 'Write something in your review.',

    // recenziile membrilor, like-uri, poze si spoilere in comentarii
    'Recenzii populare': 'Popular reviews', 'Recenzii recente': 'Recent reviews', 'Îmi place recenzia': 'Like this review',
    'Poză': 'Photo', 'Spoiler': 'Spoiler', 'spoiler': 'spoiler', 'Spoiler · click ca să vezi': 'Spoiler · click to reveal',
    'Adaugă o poză': 'Add a photo', 'Scoate poza': 'Remove photo', 'Mărește poza': 'Enlarge photo', 'Ascunde comentariul până dă click': 'Hide the comment until clicked',
    'Scrie ceva sau adaugă o poză.': 'Write something or add a photo.', 'Fișierul nu e o poză.': "That file isn't a photo.", 'Poza e prea mare. Încearcă alta.': 'The photo is too large. Try another.',
    'Like-urile nu sunt pornite încă pe site.': "Likes aren't enabled on the site yet.", 'Recenzia nu mai există.': 'This review no longer exists.',
    'Conține spoilere — deschide ca să citești.': 'Contains spoilers — open to read.', 'ți-a apreciat recenzia pentru': 'liked your review of', '(poză)': '(photo)',

    // comentarii
    'Comentarii': 'Comments', 'Niciun comentariu încă.': 'No comments yet.', 'Scrie ceva pe profilul tău…': 'Write something on your profile…',
    'ți-a scris pe': 'wrote on your', 'profil': 'profile',
    'Comentează': 'Comment', 'Trimite': 'Send', 'Scrie un comentariu…': 'Write a comment…', 'Ștergi comentariul?': 'Delete this comment?', 'Șterge comentariul': 'Delete comment',
    'Intră în cont': 'Log in', 'ca să comentezi.': 'to comment.', 'Membru': 'Member', 'a comentat la recenzia ta pentru': 'commented on your review of',
    'Comentariile nu sunt pornite încă pe site.': "Comments aren't enabled on the site yet.", 'Scrie ceva înainte să trimiți.': 'Write something before sending.',

    // anul in seriale
    'Anul tău în seriale': 'Your year in TV', 'Anul în seriale': 'Year in review', 'Distribuie': 'Share', 'Link copiat': 'Link copied', 'Copiază linkul:': 'Copy the link:',
    'Ore de privit': 'Hours watched', 'Episoade': 'Episodes', 'Nota medie': 'Average rating', 'Recenzii scrise': 'Reviews written',
    'Cel mai bine notat': 'Top rated', 'Serialul anului': 'Show of the year', 'Luna cea mai activă': 'Busiest month', 'Ziua preferată': 'Favorite day',
    'Maratonul anului': 'Biggest binge', 'Primul din an': 'First of the year', 'Cel mai recent': 'Most recent', 'Pe luni': 'By month', 'Genuri': 'Genres',
    'Top seriale': 'Top shows', 'Top filme': 'Top movies', 'Orele, topurile și momentele anului, într-o singură pagină.': 'The hours, top picks and moments of the year, on one page.',
    'Ai văzut câteva seriale': 'You watched a few shows', 'A văzut câteva seriale': 'They watched a few shows', 'anul ăsta': 'this year',
    '…bine, poate mai mult decât câteva.': '…okay, maybe more than a few.', 'Hai să vedem anul tău': "Let's look at your year", 'Totul din jurnal': 'All from the diary',
    'Filmul anului': 'Movie of the year', 'Seriale văzute': 'Shows watched', 'Filme văzute': 'Movies watched', 'Cele mai multe într-o singură zi': 'Most in a single day',
    'Aici ți-a mers timpul anul ăsta': 'Here’s where your time went this year', 'Încălzirea s-a terminat': 'The warm-up is over', 'acum vin detaliile': 'now for the details',
    'Genurile tale': 'Your genres', 'Genurile lui': 'Their genres', 'Înapoi la profil': 'Back to profile',
    'Calculat din jurnal: un episod notat = un episod, un sezon notat = toate episoadele lui. Orele sunt aproximative.': 'Based on the diary: a logged episode = one episode, a logged season = all its episodes. Hours are approximate.',
  };
  const WEEKDAY = { Duminică: 'Sunday', Luni: 'Monday', Marți: 'Tuesday', Miercuri: 'Wednesday', Joi: 'Thursday', Vineri: 'Friday', Sâmbătă: 'Saturday' };

  const MONTHS = { Ianuarie: 'January', Februarie: 'February', Martie: 'March', Aprilie: 'April', Mai: 'May', Iunie: 'June', Iulie: 'July', August: 'August', Septembrie: 'September', Octombrie: 'October', Noiembrie: 'November', Decembrie: 'December' };
  const MON = { ian: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', mai: 'May', iun: 'Jun', iul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', noi: 'Nov', dec: 'Dec' };
  const date = (s) => s.replace(/\b(\d{1,2}) (ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|noi|dec) (\d{4})\b/g, (m, d, mo, y) => `${MON[mo]} ${d}, ${y}`);
  const tr = (s) => D[s] || s;
  const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;

  // tipare pentru texte cu nume si numere (doar potriviri pe tot textul)
  const P = [
    [/^Status: (.+)$/, (m, x) => `Status: ${translateString(x)}`],
    [/^(\d+) episoade văzute$/, (m, n) => `${n} episodes watched`],
    [/^Ștergi „(.+)” din bibliotecă\? Se șterg și intrările din jurnal pentru el\.$/, (m, x) => `Remove “${x}” from your library? Its diary entries are deleted too.`],
    [/^„(.+)” a fost scos din bibliotecă$/, (m, x) => `“${x}” was removed from your library`],
    [/^(Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie) (\d{4})$/, (m, mo, y) => `${MONTHS[mo]} ${y}`],
    [/^\d{1,2} (ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|noi|dec) \d{4}$/, (m) => date(m)],
    [/^(ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|noi|dec) (\d{4})$/i, (m, mo, y) => `${MON[mo.toLowerCase()]} ${y}`],
    [/^(@\S+ · )?Membru din (.+)$/, (m, at, d) => `${at || ''}Member since ${date(d)}`],
    [/^(\d+)l (\d+)z (\d+)h$/, (m, a, b, c) => `${a}mo ${b}d ${c}h`],
    [/^La seriale \((\d+)l (\d+)z (\d+)h\)$/, (m, a, b, c) => `On TV (${a}mo ${b}d ${c}h)`],
    [/^(\d+) (seriale|filme|episoade|sezoane|titluri|membri|intrări)$/, (m, n, w) => `${n} ${{ seriale: 'shows', filme: 'movies', episoade: 'episodes', sezoane: 'seasons', titluri: 'titles', membri: 'members', intrări: 'entries' }[w]}`],
    [/^(\d+) (serial|film|episod|sezon|titlu|membru)$/, (m, n, w) => `${n} ${{ serial: 'show', film: 'movie', episod: 'episode', sezon: 'season', titlu: 'title', membru: 'member' }[w]}`],
    [/^Sezonul (\d+)$/, (m, n) => `Season ${n}`],
    [/^Sezoane \((\d+)\)$/, (m, n) => `Seasons (${n})`],
    [/^(S\d+ · E\d+|Sezonul \d+|Serial|Film)( · \d{4})?$/, (m, a, y) => `${a.replace('Sezonul', 'Season').replace('Serial', 'TV show').replace('Film', 'Movie')}${y || ''}`],
    [/^(.+) · (\d+)$/, (m, a, n) => (D[a] ? `${D[a]} · ${n}` : null)],
    [/^· (\d+)$/, (m) => m],
    [/^Rezultate pentru „(.*)”$/, (m, q) => `Results for “${q}”`],
    [/^Vezi toate rezultatele pentru „(.*)”$/, (m, q) => `See all results for “${q}”`],
    [/^(\d+) seriale · (\d+) filme(?: · (\d+) membri)?(\. Click pe un poster ca să-l adaugi în jurnal\.)?$/, (m, a, b, c, d) => `${a} shows · ${b} movies${c ? ` · ${c} members` : ''}${d ? '. Click a poster to add it to your diary.' : ''}`],
    [/^@(\S+) · (\d+) seriale · (\d+) filme(?: · (\d+) în jurnal)?$/, (m, u, a, b, c) => `@${u} · ${a} shows · ${b} movies${c ? ` · ${c} in diary` : ''}`],
    [/^@(\S+) · (\d+) seriale · (\d+) filme$/, (m, u, a, b) => `@${u} · ${a} shows · ${b} movies`],
    [/^„(.+)” a fost adăugat$/, (m, t) => `“${t}” added`],
    [/^„(.+)” adăugat$/, (m, t) => `“${t}” added`],
    [/^(\d+) imagini · click pe cea dorită$/, (m, n) => `${n} images · click the one you want`],
    [/^Poți avea maxim (\d+) favorite\. Scoate unul din Setări → Seriale favorite\.$/, (m, n) => `You can have at most ${n} favorites. Remove one in Settings → Favorite shows.`],
    [/^Îl scoți pe (.+) de la prieteni\?$/, (m, n) => `Remove ${n} from your friends?`],
    [/^Ștergi „(.+)”\? Se șterg și intrările din jurnal pentru el\.$/, (m, t) => `Delete “${t}”? Its diary entries will be deleted too.`],
    [/^Ștergi lista „(.+)”\? Titlurile rămân în bibliotecă\.$/, (m, t) => `Delete the list “${t}”? The titles stay in your library.`],
    [/^Nu există niciun utilizator @(.+)\.$/, (m, u) => `There is no user @${u}.`],
    [/^Ultima publicare: (.+)$/, (m, d) => `Last published: ${d}`],
    [/^(.+) · (Seriale|Filme|Recenzii|Aprecieri|Jurnal|Liste|Listă|Statistici|Prieteni|Anul în seriale|EDITSEL)$/, (m, a, b) => `${tr(a)} · ${{ Seriale: 'TV shows', Filme: 'Movies', Recenzii: 'Reviews', Aprecieri: 'Likes', Jurnal: 'Diary', Liste: 'Lists', Listă: 'List', Statistici: 'Stats', Prieteni: 'Friends', 'Anul în seriale': 'Year in review', EDITSEL: 'EDITSEL' }[b]}`],
    [/^„(.*)” · Căutare · EDITSEL$/, (m, q) => `“${q}” · Search · EDITSEL`],
    [/^(\d{4}) • (.+)$/, (m, y, rest) => `${y} • ${rest.replace(/(\d+) sezoane/, '$1 seasons').replace(/(\d+) sezon\b/, '$1 season')}`],
    [/^(\d+) \/ (\d+)$/, (m) => m],
    [/^din (\d+)$/, (m, n) => `of ${n}`],
    [/^(\d+) ep\.$/, (m, n) => `${n} ep.`],
    [/^(\d+) (comentariu|comentarii|intrare|intrări)$/, (m, n, w) => `${n} ${{ comentariu: 'comment', comentarii: 'comments', intrare: 'entry', intrări: 'entries' }[w]}`],
    [/^(\d+) (episod|episoade) și (\d+) (film|filme)$/, (m, a, w, b, v) => `${a} ${w === 'episod' ? 'episode' : 'episodes'} and ${b} ${v === 'film' ? 'movie' : 'movies'}`],
    [/^(Duminică|Luni|Marți|Miercuri|Joi|Vineri|Sâmbătă), (\d{1,2}) (\p{L}+)$/u, (m, d, n, mo) => {
      const k = mo.charAt(0).toUpperCase() + mo.slice(1);
      return MONTHS[k] ? `${WEEKDAY[d]}, ${MONTHS[k]} ${n}` : null;
    }],
    [/^(Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie)$/, (m) => MONTHS[m]],
    [/^(Anul tău în seriale|Anul în seriale) · (\d{4})$/, (m, a, y) => `${D[a]} · ${y}`],
    [/^Ce părere ai despre (.+)\?$/, (m, t) => `What did you think of ${t}?`],
    [/^Recenzii \((\d+)\)$/, (m, n) => `Reviews (${n})`],
    [/^nota medie din (\d+) (recenzie|recenzii) pe EDITSEL$/, (m, n, w) => `average from ${n} ${w === 'recenzie' ? 'review' : 'reviews'} on EDITSEL`],
    [/^Scrie-i ceva lui (.+)…$/, (m, n) => `Write something to ${n}…`],
    [/^Descoperă anul( tău)? (\d{4})$/, (m, you, y) => `Explore ${you ? 'your ' : ''}${y}`],
    [/^Hai să vedem anul lui (.+)$/, (m, n) => `Let's look at ${n}'s year`],
    [/^(\d+) (vizionare|vizionări)$/, (m, n, w) => `${n} ${w === 'vizionare' ? 'watch' : 'watches'}`],
    [/^(\d+)% din tot$/, (m, n) => `${n}% of all`],
    [/^(\d+) (intrare|intrări) în jurnal$/, (m, n, w) => `${n} diary ${w === 'intrare' ? 'entry' : 'entries'}`],
    [/^Ne vedem în (\d{4})$/, (m, y) => `See you in ${y}`],
    [/^(.+), (.+) în jurnal și (\d+) ore de privit\.$/, (m, a, b, h) => `${translateString(a)}, ${translateString(b)} in the diary and ${h} hours watched.`],
    [/^Wrapped (\d{4}) · (Anul tău în seriale|Anul în seriale)$/, (m, y, a) => `Wrapped ${y} · ${D[a]}`],
    [/^N-a(i?) notat nimic în jurnal în (\d{4})\.$/, (m, you, y) => `${you ? 'You' : 'They'} didn't log anything in ${y}.`],
  ];

  // pentru fiecare cheie cu simbol la inceput/sfarsit („✓ Acceptă”, „Mai multe opțiuni ▾”), si varianta fara simbol
  const SYM = /^[^\p{L}\d„“"(]+\s*|\s*[^\p{L}\d”"\.)?!…]+$/gu;
  for (const k of Object.keys(D)) {
    const bare = k.replace(SYM, '');
    if (bare && bare !== k && !D[bare]) D[bare] = D[k].replace(SYM, '');
  }

  function translateString(s) {
    if (!s || !/[A-Za-zĂÂÎȘȚăâîșț]/.test(s)) return s;
    const lead = s.match(/^\s*/)[0];
    const trail = s.match(/\s*$/)[0];
    const core = s.trim();
    if (D[core]) return lead + D[core] + trail;
    // simboluri la inceput/sfarsit („▶ Văzut”, „Vezi tot ›”)
    const m = core.match(/^([^\p{L}\d„“"]*)(.*?)([^\p{L}\d”"\.)?!]*)$/u);
    if (m && m[2] && D[m[2]]) return lead + m[1] + D[m[2]] + m[3] + trail;
    for (const [re, fn] of P) {
      const mm = core.match(re);
      if (mm) { const r = fn(...mm); if (r) return lead + r + trail; }
    }
    return s;
  }

  // nu traducem continutul membrilor
  const SKIP = 'textarea, input, script, style, .profile-bio, .review .text, .cmt-text, .cmt-name, .mrv .text, .mrv-name, .prv-by em, .overview, .tagline, .poster-fallback, .diary-title, .hs-text b, .disc-over b, .trend-title, .member-body b, .friend-card b, .list-card h3, .list-card p, .cast, .profile-head h1, .title-head h1, .notranslate';

  const doneText = new WeakMap(); // nod text -> textul pus de noi
  const doneAttr = new WeakMap(); // element -> { atribut: valoarea pusa de noi }
  function setText(n) {
    if (doneText.get(n) === n.nodeValue) return;
    const t = translateString(n.nodeValue);
    if (t !== n.nodeValue) n.nodeValue = t;
    doneText.set(n, t);
  }
  function setAttr(n, attr, v) {
    const d = doneAttr.get(n) || {};
    if (d[attr] === v) return;
    const t = translateString(v);
    if (t !== v) n.setAttribute(attr, t);
    d[attr] = t;
    doneAttr.set(n, d);
  }

  function translateNode(root) {
    if (lang !== 'en' || !root) return;
    if (root.nodeType === 3) {
      const p = root.parentElement;
      if (p && !p.closest(SKIP)) setText(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest('script, style, textarea')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root;
    while (n) {
      if (n.nodeType === 1) {
        for (const attr of ['placeholder', 'title', 'aria-label']) {
          const v = n.getAttribute && n.getAttribute(attr);
          if (v) setAttr(n, attr, v);
        }
      } else if (n.nodeType === 3) {
        const p = n.parentElement;
        if (p && !p.closest(SKIP)) setText(n);
      }
      n = walker.nextNode();
    }
  }

  function start() {
    document.documentElement.lang = lang;
    if (lang !== 'en') return;
    translateNode(document.body);
    document.title = translateString(document.title);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') translateNode(m.target);
        else if (m.type === 'attributes') translateNode(m.target);
        else m.addedNodes.forEach(translateNode);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    const titleEl = document.querySelector('title');
    let lastTitle = document.title;
    if (titleEl) new MutationObserver(() => { if (document.title === lastTitle) return; const t = translateString(document.title); lastTitle = t; if (t !== document.title) document.title = t; }).observe(titleEl, { childList: true, characterData: true, subtree: true });
    // ferestrele native (confirmari, alerte)
    const wrap = (fn) => (msg, ...rest) => fn.call(window, translateString(String(msg)), ...rest);
    window.confirm = wrap(window.confirm);
    window.alert = wrap(window.alert);
    window.prompt = wrap(window.prompt);
  }

  // butoanele RO / EN
  function setLang(next) {
    try { localStorage.setItem(KEY, next); } catch { /* fara memorie locala */ }
    location.reload();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.lang !== lang) setLang(b.dataset.lang);
  });
  function markButtons() {
    document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
  }

  window.EDITSEL_LANG = lang;
  window.EDITSEL_T = translateString;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { markButtons(); start(); });
  else { markButtons(); start(); }
})();
