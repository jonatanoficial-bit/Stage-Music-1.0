
(function () {
  const NOTE_SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT_TO_SHARP = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};

  const state = {
    allSongs: [],
    filteredSongs: [],
    selectedId: null,
    filter: 'all',
    scrollTimer: null,
    scrollSpeed: 3,
    setlist: [],
    savedSetlists: readSavedSetlists(),
    favorites: readFavorites(),
    transpose: 0,
    mirrored: false
  };

  const $ = (id) => document.getElementById(id);
  const dom = {
    libraryList: $('libraryList'),
    libraryCount: $('libraryCount'),
    searchInput: $('searchInput'),
    viewerTitle: $('viewerTitle'),
    viewerSubtitle: $('viewerSubtitle'),
    metaKey: $('metaKey'),
    metaBpm: $('metaBpm'),
    metaCapo: $('metaCapo'),
    metaSource: $('metaSource'),
    viewerContent: $('viewerContent'),
    fontRange: $('fontRange'),
    increaseFont: $('increaseFont'),
    decreaseFont: $('decreaseFont'),
    copyText: $('copyText'),
    toggleFavorite: $('toggleFavorite'),
    startScroll: $('startScroll'),
    scrollSpeed: $('scrollSpeed'),
    toggleStageMode: $('toggleStageMode'),
    refreshLibrary: $('refreshLibrary'),
    addToSetlist: $('addToSetlist'),
    setlistList: $('setlistList'),
    setlistCount: $('setlistCount'),
    nextSongCard: $('nextSongCard'),
    nextSong: $('nextSong'),
    prevSong: $('prevSong'),
    jumpInput: $('jumpInput'),
    jumpButton: $('jumpButton'),
    saveSetlist: $('saveSetlist'),
    clearSetlist: $('clearSetlist'),
    setlistTitle: $('setlistTitle'),
    savedSetlistsSelect: $('savedSetlistsSelect'),
    loadSavedSetlist: $('loadSavedSetlist'),
    deleteSavedSetlist: $('deleteSavedSetlist'),
    pdfInput: $('pdfInput'),
    scrollProgress: $('scrollProgress'),
    transposeDown: $('transposeDown'),
    transposeUp: $('transposeUp'),
    toggleMirror: $('toggleMirror')
  };

  function unregisterOldCaches() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
  }

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function normalizeSong(song, origin) {
    return {
      id: song.id || `${origin}-${song.title || 'song'}-${song.artist || 'artist'}`.toLowerCase().replace(/\s+/g, '-'),
      title: song.title || 'Sem título',
      artist: song.artist || 'Artista não informado',
      key: song.key || '—',
      bpm: song.bpm || '—',
      capo: song.capo || '—',
      tags: Array.isArray(song.tags) ? song.tags : String(song.tags || '').split(',').map(v => v.trim()).filter(Boolean),
      notes: song.notes || '',
      lyrics: song.lyrics || '',
      source: origin === 'online' ? 'Online' : 'Local',
      sourceType: origin,
      pdf: song.pdf || ''
    };
  }

  async function fetchOnlineLibrary() {
    const response = await fetch('content/online-library/manifest.json?b=121', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('manifest.json não encontrado');
    }
    const payload = await response.json();
    const musics = Array.isArray(payload.musics) ? payload.musics : [];
    return musics.map(song => normalizeSong(song, 'online'));
  }

  function getLocalLibrary() {
    return readLocalPdfs().map(item => normalizeSong({
      title: item.title,
      artist: 'PDF Local',
      key: '—',
      bpm: '—',
      capo: '—',
      tags: ['pdf', 'local'],
      notes: 'Arquivo local do músico',
      lyrics: '',
      pdf: item.dataUrl
    }, 'local'));
  }

  function currentSong() {
    return state.allSongs.find(song => song.id === state.selectedId) ||
           state.setlist.find(song => song.id === state.selectedId) ||
           null;
  }

  function favoriteIds() {
    return new Set(state.favorites.map(item => item.id));
  }

  function isFavorite(id) {
    return favoriteIds().has(id);
  }

  function toSharp(note) {
    return FLAT_TO_SHARP[note] || note;
  }

  function transposeRoot(root, delta) {
    const index = NOTE_SHARPS.indexOf(toSharp(root));
    if (index === -1) return root;
    return NOTE_SHARPS[(index + delta + 120) % 12];
  }

  function transposeChordToken(token, delta) {
    const parts = token.split('/');
    const left = parts[0].replace(/^([A-G](?:#|b)?)/, m => transposeRoot(m, delta));
    return parts[1] ? `${left}/${transposeRoot(parts[1], delta)}` : left;
  }

  function transposeText(text, delta) {
    if (!delta) return text;
    return String(text).replace(/\b([A-G](?:#|b)?(?:m|maj7|7|sus2|sus4|dim|add9|9|11|13)?(?:\/[A-G](?:#|b)?)?)\b/g, m => transposeChordToken(m, delta));
  }

  function highlightLyrics(text) {
    return String(text).split('\n').map(line => {
      const safe = esc(line);
      if (/^[\[(#].+[\])]?$/.test(line.trim())) {
        return `<span class="section">${safe}</span>`;
      }
      return safe.replace(/\b([A-G](#|b)?(m|maj7|7|sus2|sus4|dim|add9|9|11|13)?)(\/([A-G](#|b)?))?\b/g, '<span class="chord">$1</span>');
    }).join('\n');
  }

  function updateFavoriteButton() {
    const song = currentSong();
    if (dom.toggleFavorite) {
      dom.toggleFavorite.textContent = song && isFavorite(song.id) ? '★' : '☆';
    }
  }

  function renderSavedSetlists() {
    if (!dom.savedSetlistsSelect) return;
    dom.savedSetlistsSelect.innerHTML =
      '<option value="">Setlists salvos</option>' +
      state.savedSetlists.map(item => `<option value="${item.id}">${esc(item.name)}</option>`).join('');
  }

  function renderLibrary() {
    if (!dom.libraryList) return;
    const q = dom.searchInput ? dom.searchInput.value.trim().toLowerCase() : '';

    state.filteredSongs = state.allSongs.filter(song => {
      const matchesFilter =
        state.filter === 'all' ||
        song.sourceType === state.filter ||
        (state.filter === 'favorites' && isFavorite(song.id));

      const bag = [song.title, song.artist, song.key, song.notes, song.tags.join(' ')].join(' ').toLowerCase();
      return matchesFilter && bag.includes(q);
    });

    if (dom.libraryCount) {
      dom.libraryCount.textContent = `${state.filteredSongs.length} faixas`;
    }

    if (!state.filteredSongs.length) {
      dom.libraryList.innerHTML = '<div class="empty-state"><div class="empty-icon">⊘</div><p>Nenhuma música encontrada.</p></div>';
      return;
    }

    dom.libraryList.innerHTML = state.filteredSongs.map(song => `
      <article class="song-item ${song.id === state.selectedId ? 'active' : ''}" data-id="${song.id}">
        <h3>${esc(song.title)}</h3>
        <p>${esc(song.artist)} • Tom ${esc(song.key)} • ${esc(song.source)}</p>
        <div class="song-tags">
          ${isFavorite(song.id) ? '<span class="tag">favorita</span>' : ''}
          ${(song.tags.length ? song.tags : ['sem tags']).slice(0, 4).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}
        </div>
      </article>
    `).join('');

    dom.libraryList.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', () => openSong(item.dataset.id));
    });
  }

  function renderSetlist() {
    if (dom.setlistCount) dom.setlistCount.textContent = `${state.setlist.length} músicas`;

    const currentIndex = state.setlist.findIndex(song => song.id === state.selectedId);
    const nextSong = currentIndex >= 0 ? state.setlist[currentIndex + 1] : state.setlist[0];
    if (dom.nextSongCard) {
      dom.nextSongCard.textContent = nextSong ? `Próxima: ${nextSong.title} — ${nextSong.artist}` : 'Nenhuma próxima música';
    }

    if (!dom.setlistList) return;

    if (!state.setlist.length) {
      dom.setlistList.innerHTML = '<div class="empty-state"><div class="empty-icon">♪</div><p>Monte seu repertório ao vivo.</p></div>';
      renderSavedSetlists()
      return;
    }

    dom.setlistList.innerHTML = state.setlist.map((song, index) => `
      <article class="setlist-item ${song.id === state.selectedId ? 'active' : ''}" data-id="${song.id}">
        <h4>${index + 1}. ${esc(song.title)}</h4>
        <p>${esc(song.artist)} • Tom ${esc(song.key)}</p>
        <div class="setlist-inline">
          <button class="mini-btn up" data-index="${index}" type="button">↑</button>
          <button class="mini-btn down" data-index="${index}" type="button">↓</button>
          <button class="mini-btn remove" data-index="${index}" type="button">Remover</button>
        </div>
      </article>
    `).join('');

    dom.setlistList.querySelectorAll('.setlist-item').forEach(item => {
      item.addEventListener('click', () => openSong(item.dataset.id));
    });
    dom.setlistList.querySelectorAll('.up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = Number(btn.dataset.index);
        if (i > 0) [state.setlist[i - 1], state.setlist[i]] = [state.setlist[i], state.setlist[i - 1]];
        renderSetlist();
      });
    });
    dom.setlistList.querySelectorAll('.down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = Number(btn.dataset.index);
        if (i < state.setlist.length - 1) [state.setlist[i + 1], state.setlist[i]] = [state.setlist[i], state.setlist[i + 1]];
        renderSetlist();
      });
    });
    dom.setlistList.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.setlist.splice(Number(btn.dataset.index), 1);
        renderSetlist();
      });
    });

    renderSavedSetlists();
  }

  function renderCurrentSong() {
    const song = currentSong();
    if (!song || !dom.viewerContent) return;

    if (song.pdf) {
      dom.viewerContent.classList.toggle('mirrored', state.mirrored);
      dom.viewerContent.innerHTML = `<iframe src="${song.pdf}" style="width:100%;height:72vh;border:none;border-radius:18px;background:#fff"></iframe>`;
      if (dom.metaKey) dom.metaKey.textContent = song.key || '—';
      return;
    }

    const transposed = transposeText(song.lyrics || 'Sem letra/cifra cadastrada.', state.transpose);
    dom.viewerContent.classList.toggle('mirrored', state.mirrored);
    dom.viewerContent.innerHTML = highlightLyrics(transposed);

    if (dom.metaKey) {
      dom.metaKey.textContent = (song.key && song.key !== '—') ? transposeRoot(song.key, state.transpose) : '—';
    }
  }

  function openSong(id) {
    const song = state.allSongs.find(item => item.id === id) || state.setlist.find(item => item.id === id);
    if (!song) return;

    state.selectedId = id;
    state.transpose = 0;

    if (dom.viewerTitle) dom.viewerTitle.textContent = song.title;
    if (dom.viewerSubtitle) dom.viewerSubtitle.textContent = `${song.artist}${song.notes ? ' • ' + song.notes : ''}`;
    if (dom.metaBpm) dom.metaBpm.textContent = song.bpm || '—';
    if (dom.metaCapo) dom.metaCapo.textContent = song.capo || '—';
    if (dom.metaSource) dom.metaSource.textContent = song.source || '—';

    renderCurrentSong();
    renderLibrary();
    renderSetlist();
    updateFavoriteButton();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadLibrary() {
    try {
      const online = await fetchOnlineLibrary();
      const local = getLocalLibrary();
      state.allSongs = [...online, ...local];

      renderLibrary();
      renderSetlist();

      if (state.allSongs.length && !state.selectedId) {
        openSong(state.allSongs[0].id);
      }
    } catch (e) {
      if (dom.libraryCount) dom.libraryCount.textContent = 'erro';
      if (dom.libraryList) {
        dom.libraryList.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><p>Não foi possível carregar a biblioteca.</p><p style="font-size:.9rem">${esc(e.message)}</p></div>`;
      }
      console.error(e);
    }
  }

  function setViewerSize(size) {
    document.documentElement.style.setProperty('--size', `${size}px`);
    if (dom.fontRange) dom.fontRange.value = size;
  }

  function toggleScroll() {
    if (state.scrollTimer) {
      clearInterval(state.scrollTimer);
      state.scrollTimer = null;
      if (dom.startScroll) dom.startScroll.textContent = 'Auto Scroll';
      return;
    }

    state.scrollTimer = setInterval(() => {
      window.scrollBy({ top: state.scrollSpeed, left: 0, behavior: 'smooth' });
      updateProgress();
    }, 90);

    if (dom.startScroll) dom.startScroll.textContent = 'Parar Scroll';
  }

  function updateProgress() {
    if (!dom.scrollProgress) return;
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
    dom.scrollProgress.style.width = `${pct}%`;
  }

  function addCurrentToSetlist() {
    const song = currentSong();
    if (!song) return;
    state.setlist.push({ ...song });
    renderSetlist();
  }

  function goRelative(delta) {
    if (!state.setlist.length) return;
    const idx = state.setlist.findIndex(song => song.id === state.selectedId);
    const nextIdx = idx === -1 ? 0 : Math.min(Math.max(idx + delta, 0), state.setlist.length - 1);
    openSong(state.setlist[nextIdx].id);
  }

  function jumpToTrack() {
    const idx = Number(dom.jumpInput ? dom.jumpInput.value : 0) - 1;
    if (idx >= 0 && idx < state.setlist.length) {
      openSong(state.setlist[idx].id);
    }
  }

  function saveSetlist() {
    const name = prompt('Nome do repertório:', `Setlist ${new Date().toLocaleDateString('pt-BR')}`);
    if (!name) return;
    state.savedSetlists.unshift({
      id: `setlist-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      songs: state.setlist
    });
    writeSavedSetlists(state.savedSetlists);
    if (dom.setlistTitle) dom.setlistTitle.textContent = `Setlist atual • ${name}`;
    renderSavedSetlists();
  }

  function loadSavedSetlist() {
    const id = dom.savedSetlistsSelect ? dom.savedSetlistsSelect.value : '';
    if (!id) return;
    const item = state.savedSetlists.find(entry => entry.id === id);
    if (!item) return;
    state.setlist = (item.songs || []).map(song => ({ ...song }));
    if (dom.setlistTitle) dom.setlistTitle.textContent = `Setlist atual • ${item.name}`;
    renderSetlist();
    if (state.setlist.length) openSong(state.setlist[0].id);
  }

  function deleteSavedSetlist() {
    const id = dom.savedSetlistsSelect ? dom.savedSetlistsSelect.value : '';
    if (!id) return;
    state.savedSetlists = state.savedSetlists.filter(item => item.id !== id);
    writeSavedSetlists(state.savedSetlists);
    renderSavedSetlists();
  }

  function toggleFavorite() {
    const song = currentSong();
    if (!song) return;
    if (isFavorite(song.id)) {
      state.favorites = state.favorites.filter(item => item.id !== song.id);
    } else {
      state.favorites.unshift({ id: song.id, title: song.title });
    }
    writeFavorites(state.favorites);
    renderLibrary();
    updateFavoriteButton();
  }

  function handlePdfUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const items = readLocalPdfs();
      items.unshift({
        title: file.name.replace(/\.pdf$/i, ''),
        dataUrl: reader.result
      });
      writeLocalPdfs(items);
      await loadLibrary();
    };
    reader.readAsDataURL(file);
  }

  function handleKeys(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight') goRelative(1);
    else if (e.key === 'ArrowLeft') goRelative(-1);
    else if (e.key === ' ') {
      e.preventDefault();
      toggleScroll();
    }
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
      tab.classList.add('active');
      state.filter = tab.dataset.filter;
      renderLibrary();
    });
  });

  if (dom.searchInput) dom.searchInput.addEventListener('input', renderLibrary);
  if (dom.refreshLibrary) dom.refreshLibrary.addEventListener('click', loadLibrary);
  if (dom.pdfInput) dom.pdfInput.addEventListener('change', handlePdfUpload);
  if (dom.toggleStageMode) dom.toggleStageMode.addEventListener('click', () => document.body.classList.toggle('stage-mode'));
  if (dom.increaseFont) dom.increaseFont.addEventListener('click', () => setViewerSize(Math.min(44, Number(dom.fontRange ? dom.fontRange.value : 21) + 1)));
  if (dom.decreaseFont) dom.decreaseFont.addEventListener('click', () => setViewerSize(Math.max(14, Number(dom.fontRange ? dom.fontRange.value : 21) - 1)));
  if (dom.fontRange) dom.fontRange.addEventListener('input', (e) => setViewerSize(e.target.value));
  if (dom.startScroll) dom.startScroll.addEventListener('click', toggleScroll);
  if (dom.scrollSpeed) dom.scrollSpeed.addEventListener('input', (e) => state.scrollSpeed = Number(e.target.value));
  if (dom.addToSetlist) dom.addToSetlist.addEventListener('click', addCurrentToSetlist);
  if (dom.nextSong) dom.nextSong.addEventListener('click', () => goRelative(1));
  if (dom.prevSong) dom.prevSong.addEventListener('click', () => goRelative(-1));
  if (dom.jumpButton) dom.jumpButton.addEventListener('click', jumpToTrack);
  if (dom.jumpInput) dom.jumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') jumpToTrack(); });
  if (dom.saveSetlist) dom.saveSetlist.addEventListener('click', saveSetlist);
  if (dom.loadSavedSetlist) dom.loadSavedSetlist.addEventListener('click', loadSavedSetlist);
  if (dom.deleteSavedSetlist) dom.deleteSavedSetlist.addEventListener('click', deleteSavedSetlist);
  if (dom.clearSetlist) dom.clearSetlist.addEventListener('click', () => { state.setlist = []; renderSetlist(); });
  if (dom.copyText) {
    dom.copyText.addEventListener('click', async () => {
      const song = currentSong();
      if (!song || song.pdf) return;
      try {
        await navigator.clipboard.writeText(transposeText(song.lyrics || '', state.transpose));
        dom.copyText.textContent = 'Copiado';
        setTimeout(() => dom.copyText.textContent = 'Copiar', 1200);
      } catch (e) {}
    });
  }
  if (dom.toggleFavorite) dom.toggleFavorite.addEventListener('click', toggleFavorite);
  if (dom.transposeUp) dom.transposeUp.addEventListener('click', () => { state.transpose += 1; renderCurrentSong(); });
  if (dom.transposeDown) dom.transposeDown.addEventListener('click', () => { state.transpose -= 1; renderCurrentSong(); });
  if (dom.toggleMirror) dom.toggleMirror.addEventListener('click', () => { state.mirrored = !state.mirrored; renderCurrentSong(); });

  window.addEventListener('keydown', handleKeys);
  window.addEventListener('scroll', updateProgress, { passive: true });

  unregisterOldCaches();
  setViewerSize(21);
  renderSavedSetlists();
  loadLibrary();
  updateProgress();
})();
