
const state = {
  allSongs: [],
  filteredSongs: [],
  selectedId: null,
  filter: 'all',
  scrollTimer: null,
  scrollSpeed: 3
};

const dom = {
  musicList: document.getElementById('musicList'),
  libraryCount: document.getElementById('libraryCount'),
  searchInput: document.getElementById('searchInput'),
  viewerTitle: document.getElementById('viewerTitle'),
  viewerSubtitle: document.getElementById('viewerSubtitle'),
  metaKey: document.getElementById('metaKey'),
  metaBpm: document.getElementById('metaBpm'),
  metaCapo: document.getElementById('metaCapo'),
  metaSource: document.getElementById('metaSource'),
  musicContent: document.getElementById('musicContent'),
  fontRange: document.getElementById('fontRange'),
  increaseFont: document.getElementById('increaseFont'),
  decreaseFont: document.getElementById('decreaseFont'),
  copyText: document.getElementById('copyText'),
  startScroll: document.getElementById('startScroll'),
  scrollSpeed: document.getElementById('scrollSpeed'),
  toggleStageMode: document.getElementById('toggleStageMode'),
  refreshLibrary: document.getElementById('refreshLibrary')
};

function normalizeSong(song, origin) {
  return {
    id: song.id || `${origin}-${song.title}-${song.artist}`.toLowerCase().replace(/\s+/g, '-'),
    title: song.title || 'Sem título',
    artist: song.artist || 'Artista não informado',
    key: song.key || '—',
    bpm: song.bpm || '—',
    capo: song.capo || '—',
    tags: Array.isArray(song.tags) ? song.tags : String(song.tags || '').split(',').map(v => v.trim()).filter(Boolean),
    notes: song.notes || '',
    lyrics: song.lyrics || '',
    source: origin === 'online' ? 'Online' : 'Local',
    sourceType: origin
  };
}

async function fetchOnlineLibrary() {
  const response = await fetch('content/online-library/manifest.json', { cache: 'no-store' });
  const payload = await response.json();
  const musics = Array.isArray(payload.musics) ? payload.musics : [];
  return musics.map(song => normalizeSong(song, 'online'));
}

function getLocalLibrary() {
  return readDraftLibrary().map(song => normalizeSong(song, 'local'));
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLyrics(text) {
  return text
    .split('\n')
    .map(line => {
      const safe = escapeHtml(line);
      if (/^[\[(#].+[\])]?$/.test(line.trim())) {
        return `<span class="section">${safe}</span>`;
      }
      return safe.replace(/\b([A-G](#|b)?(m|maj7|7|sus2|sus4|dim|add9|9|11|13)?)(\/([A-G](#|b)?))?\b/g, '<span class="chord">$1</span>');
    })
    .join('\n');
}

function renderList() {
  const query = dom.searchInput.value.trim().toLowerCase();
  state.filteredSongs = state.allSongs.filter(song => {
    const matchesFilter = state.filter === 'all' || song.sourceType === state.filter;
    const bag = [song.title, song.artist, song.key, song.notes, song.tags.join(' ')].join(' ').toLowerCase();
    return matchesFilter && bag.includes(query);
  });

  dom.libraryCount.textContent = `${state.filteredSongs.length} faixas`;

  dom.musicList.innerHTML = state.filteredSongs.map(song => `
    <article class="song-item ${song.id === state.selectedId ? 'active' : ''}" data-id="${song.id}">
      <h3>${song.title}</h3>
      <p>${song.artist} • Tom ${song.key} • ${song.source}</p>
      <div class="song-tags">
        ${(song.tags.length ? song.tags : ['sem tags']).slice(0, 4).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
    </article>
  `).join('') || `
    <div class="empty-state">
      <div class="empty-icon">⊘</div>
      <p>Nenhuma música encontrada com esse filtro.</p>
    </div>
  `;

  dom.musicList.querySelectorAll('.song-item').forEach(item => {
    item.addEventListener('click', () => openSong(item.dataset.id));
  });
}

function openSong(id) {
  const song = state.allSongs.find(item => item.id === id);
  if (!song) return;
  state.selectedId = id;
  dom.viewerTitle.textContent = song.title;
  dom.viewerSubtitle.textContent = `${song.artist}${song.notes ? ' • ' + song.notes : ''}`;
  dom.metaKey.textContent = song.key || '—';
  dom.metaBpm.textContent = song.bpm || '—';
  dom.metaCapo.textContent = song.capo || '—';
  dom.metaSource.textContent = song.source;
  dom.musicContent.innerHTML = highlightLyrics(song.lyrics || 'Sem letra/cifra cadastrada.');
  renderList();
}

async function loadLibrary() {
  try {
    const online = await fetchOnlineLibrary();
    const local = getLocalLibrary();
    state.allSongs = [...online, ...local];
    renderList();
    if (state.allSongs.length && !state.selectedId) openSong(state.allSongs[0].id);
  } catch (error) {
    dom.musicList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <p>Não foi possível carregar a biblioteca online.</p>
      </div>
    `;
  }
}

function setFontSize(size) {
  document.documentElement.style.setProperty('--font-size-viewer', `${size}px`);
  dom.fontRange.value = size;
}

function toggleScroll() {
  if (state.scrollTimer) {
    clearInterval(state.scrollTimer);
    state.scrollTimer = null;
    dom.startScroll.textContent = 'Auto Scroll';
    return;
  }
  state.scrollTimer = setInterval(() => {
    window.scrollBy({ top: state.scrollSpeed, left: 0, behavior: 'smooth' });
  }, 80);
  dom.startScroll.textContent = 'Parar Scroll';
}

dom.searchInput.addEventListener('input', renderList);
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
    chip.classList.add('active');
    state.filter = chip.dataset.filter;
    renderList();
  });
});
dom.fontRange.addEventListener('input', e => setFontSize(e.target.value));
dom.increaseFont.addEventListener('click', () => setFontSize(Math.min(32, Number(dom.fontRange.value) + 1)));
dom.decreaseFont.addEventListener('click', () => setFontSize(Math.max(14, Number(dom.fontRange.value) - 1)));
dom.copyText.addEventListener('click', async () => {
  const song = state.allSongs.find(item => item.id === state.selectedId);
  if (!song) return;
  try {
    await navigator.clipboard.writeText(song.lyrics || '');
    dom.copyText.textContent = 'Copiado';
    setTimeout(() => dom.copyText.textContent = 'Copiar', 1200);
  } catch (error) {}
});
dom.startScroll.addEventListener('click', toggleScroll);
dom.scrollSpeed.addEventListener('input', e => { state.scrollSpeed = Number(e.target.value); });
dom.toggleStageMode.addEventListener('click', () => { document.body.classList.toggle('stage-mode'); });
dom.refreshLibrary.addEventListener('click', loadLibrary);

setFontSize(19);
loadLibrary();
