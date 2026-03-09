import {
  clearPdfAssets,
  downloadJSON,
  getPdfAsset,
  localStore,
  readJsonFile,
  savePdfAsset
} from './storage.js';
import { ContentManager } from './content-manager.js';
import {
  SHORTCUTS,
  clamp,
  escapeHTML,
  excerpt,
  formatSongType,
  getSongDisplayKey,
  normalizeArray,
  packLabel,
  transposeSongContent
} from './utils.js';

const contentManager = new ContentManager();
const state = {
  route: localStore.getUI().lastRoute || 'biblioteca',
  snapshot: { packs: [], songs: [], localPacks: [] },
  selectedSongId: null,
  currentSetIndex: -1,
  setlist: localStore.getSetlist(),
  ui: localStore.getUI(),
  adminLoggedIn: localStore.isAdminLoggedIn(),
  adminTab: 'songs',
  pendingPdfFile: null,
  currentPdfUrl: null,
  pendingImportAction: null,
  dialogAction: null,
  dialogLabel: null
};

const elements = {
  routeButtons: [...document.querySelectorAll('[data-route]')],
  viewSections: [...document.querySelectorAll('[data-view]')],
  libraryGrid: document.querySelector('#libraryGrid'),
  filterRow: document.querySelector('#filterRow'),
  searchInput: document.querySelector('#searchInput'),
  metricSongs: document.querySelector('#metricSongs'),
  metricPacks: document.querySelector('#metricPacks'),
  metricSetlist: document.querySelector('#metricSetlist'),
  metricStage: document.querySelector('#metricStage'),
  topbarMode: document.querySelector('#topbarMode'),
  setlistTitleInput: document.querySelector('#setlistTitleInput'),
  setlistGrid: document.querySelector('#setlistGrid'),
  setlistCountBadge: document.querySelector('#setlistCountBadge'),
  stageSongTitle: document.querySelector('#stageSongTitle'),
  stageSongMeta: document.querySelector('#stageSongMeta'),
  stageModeBadge: document.querySelector('#stageModeBadge'),
  stagePlaceholder: document.querySelector('#stagePlaceholder'),
  stageScrollArea: document.querySelector('#stageScrollArea'),
  stageText: document.querySelector('#stageText'),
  stagePdf: document.querySelector('#stagePdf'),
  stageViewer: document.querySelector('#stageViewer'),
  stageQueue: document.querySelector('#stageQueue'),
  autoscrollBadge: document.querySelector('#autoscrollBadge'),
  shortcutList: document.querySelector('#shortcutList'),
  shortcutPreview: document.querySelector('#shortcutPreview'),
  packGrid: document.querySelector('#packGrid'),
  adminLoginCard: document.querySelector('#adminLoginCard'),
  adminPanel: document.querySelector('#adminPanel'),
  adminLoginForm: document.querySelector('#adminLoginForm'),
  adminPasswordInput: document.querySelector('#adminPasswordInput'),
  adminSongList: document.querySelector('#adminSongList'),
  adminPackList: document.querySelector('#adminPackList'),
  adminTabButtons: [...document.querySelectorAll('[data-admin-tab]')],
  adminTabSongs: document.querySelector('#adminTabSongs'),
  adminTabPacks: document.querySelector('#adminTabPacks'),
  adminTabSettings: document.querySelector('#adminTabSettings'),
  songTitleInput: document.querySelector('#songTitleInput'),
  songArtistInput: document.querySelector('#songArtistInput'),
  songKeyInput: document.querySelector('#songKeyInput'),
  songBpmInput: document.querySelector('#songBpmInput'),
  songTypeInput: document.querySelector('#songTypeInput'),
  songPackInput: document.querySelector('#songPackInput'),
  songContentInput: document.querySelector('#songContentInput'),
  songNotesInput: document.querySelector('#songNotesInput'),
  songTagsInput: document.querySelector('#songTagsInput'),
  songPdfInput: document.querySelector('#songPdfInput'),
  songPdfLabel: document.querySelector('#songPdfLabel'),
  songTextWrapper: document.querySelector('#songTextWrapper'),
  songPdfWrapper: document.querySelector('#songPdfWrapper'),
  songEditId: document.querySelector('#songEditId'),
  duplicateSongButton: document.querySelector('#duplicateSongButton'),
  packIdInput: document.querySelector('#packIdInput'),
  packNameInput: document.querySelector('#packNameInput'),
  packVersionInput: document.querySelector('#packVersionInput'),
  packColorInput: document.querySelector('#packColorInput'),
  packDescriptionInput: document.querySelector('#packDescriptionInput'),
  newPasswordInput: document.querySelector('#newPasswordInput'),
  hiddenImportInput: document.querySelector('#hiddenImportInput'),
  toastStack: document.querySelector('#toastStack'),
  dialogBackdrop: document.querySelector('#dialogBackdrop'),
  dialogBody: document.querySelector('#dialogBody'),
  dialogTitle: document.querySelector('#dialogTitle'),
  dialogPrimary: document.querySelector('#dialogPrimary'),
  dialogSecondary: document.querySelector('#dialogSecondary')
};

function persistUI() {
  localStore.setUI(state.ui);
}

function persistSetlist() {
  localStore.setSetlist({
    ...state.setlist,
    updatedAt: new Date().toISOString()
  });
}

function allSongs(includeInactive = true) {
  if (!includeInactive) return state.snapshot.songs || [];
  return (state.snapshot.packs || []).flatMap((pack) => pack.songs || []);
}

function findSong(songId, includeInactive = true) {
  return allSongs(includeInactive).find((song) => song.id === songId) || null;
}

function getLocalSong(songId) {
  return (state.snapshot.localPacks || []).flatMap((pack) => pack.songs || []).find((song) => song.id === songId) || null;
}

function getLocalPack(packId) {
  return (state.snapshot.localPacks || []).find((pack) => pack.id === packId) || null;
}

function setRoute(route) {
  state.route = route;
  state.ui.lastRoute = route;
  persistUI();
  renderRoute();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type !== 'info' ? `toast--${type}` : ''}`.trim();
  toast.innerHTML = `
    <span>${message}</span>
    <button class="icon-button" type="button" aria-label="Fechar aviso">
      <svg viewBox="0 0 24 24"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.3-6.29z"/></svg>
    </button>
  `;

  toast.querySelector('button')?.addEventListener('click', () => toast.remove());
  elements.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function clearStagePdfUrl() {
  if (state.currentPdfUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(state.currentPdfUrl);
  }
  state.currentPdfUrl = null;
}

function setCurrentSetIndexBySong(songId) {
  const index = state.setlist.songIds.findIndex((id, itemIndex) => id === songId && itemIndex >= state.currentSetIndex);
  state.currentSetIndex = index >= 0 ? index : state.setlist.songIds.indexOf(songId);
}

function buildMetaChips(song, options = {}) {
  const chips = [
    `<span class="badge">${escapeHTML(formatSongType(song.type))}</span>`,
    `<span class="badge">Tom ${escapeHTML(getSongDisplayKey(song, options.transpose ?? state.ui.transpose))}</span>`
  ];

  if (song.bpm) chips.push(`<span class="badge">${escapeHTML(String(song.bpm))} BPM</span>`);
  if (song.packName) chips.push(`<span class="badge">${escapeHTML(song.packName)}</span>`);
  if (options.extra) chips.push(...options.extra);

  return chips.join('');
}

function renderRoute() {
  elements.routeButtons.forEach((button) => {
    const isActive = button.dataset.route === state.route;
    button.classList.toggle('is-active', isActive);
  });

  elements.viewSections.forEach((section) => {
    section.classList.toggle('is-active', section.dataset.view === state.route);
  });

  elements.topbarMode.textContent = state.route === 'palco' ? 'Palco' : state.route === 'admin' ? 'Admin' : 'Show';
}

function renderMetrics() {
  elements.metricSongs.textContent = String(state.snapshot.songs.length);
  elements.metricPacks.textContent = String(state.snapshot.packs.filter((pack) => pack.active).length);
  elements.metricSetlist.textContent = String(state.setlist.songIds.length);
  elements.metricStage.textContent = state.selectedSongId ? 'Ao vivo' : 'Pronto';
}

function renderFilters() {
  const counts = {
    all: state.snapshot.songs.length,
    text: state.snapshot.songs.filter((song) => song.type === 'text').length,
    pdf: state.snapshot.songs.filter((song) => song.type === 'pdf').length,
    local: state.snapshot.songs.filter((song) => song.isLocal).length
  };

  const filters = [
    ['all', `Todos (${counts.all})`],
    ['text', `Texto (${counts.text})`],
    ['pdf', `PDF (${counts.pdf})`],
    ['local', `Local (${counts.local})`]
  ];

  elements.filterRow.innerHTML = filters
    .map(
      ([key, label]) => `<button class="chip ${state.ui.filter === key ? 'is-active' : ''}" type="button" data-filter="${key}">${label}</button>`
    )
    .join('');
}

function filteredSongs() {
  const search = (state.ui.search || '').trim().toLowerCase();
  const filter = state.ui.filter || 'all';

  return state.snapshot.songs.filter((song) => {
    if (filter === 'text' && song.type !== 'text') return false;
    if (filter === 'pdf' && song.type !== 'pdf') return false;
    if (filter === 'local' && !song.isLocal) return false;
    if (search && !song.searchIndex.includes(search)) return false;
    return true;
  });
}

function renderLibrary() {
  const songs = filteredSongs();

  if (!songs.length) {
    elements.libraryGrid.innerHTML = `
      <article class="empty-state">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0-2a8 8 0 1 0 4.9 14.32l4.39 4.39 1.41-1.41-4.39-4.39A8 8 0 0 0 10 2Z"/></svg>
        </div>
        <h3>Nenhuma música encontrada</h3>
        <p>Tente ajustar os filtros, ativar mais DLCs ou importar um pack no menu de expansões.</p>
      </article>
    `;
    return;
  }

  elements.libraryGrid.innerHTML = songs
    .map((song) => {
      const title = escapeHTML(song.title);
      const artist = escapeHTML(song.artist);
      const typeLabel = escapeHTML(formatSongType(song.type));
      const excerptText = escapeHTML(excerpt(song.notes || song.content || 'Sem observações.', 160));
      return `
        <article class="song-card" data-song-card="${song.id}">
          <div class="song-card__top">
            <div>
              <h3 class="song-card__title">${title}</h3>
              <div class="muted">${artist}</div>
            </div>
            <span class="status-pill ${song.type === 'pdf' ? '' : 'status-pill--success'}">${typeLabel}</span>
          </div>
          <div class="song-card__meta">${buildMetaChips(song)}</div>
          <p class="song-card__excerpt">${excerptText}</p>
          <div class="song-card__footer">
            <div class="song-card__actions">
              <button class="pill-button pill-button--ghost" type="button" data-song-action="preview" data-song-id="${song.id}">Ver</button>
              <button class="pill-button pill-button--ghost" type="button" data-song-action="add" data-song-id="${song.id}">No repertório</button>
              <button class="pill-button" type="button" data-song-action="open" data-song-id="${song.id}">Palco</button>
            </div>
            <span class="badge">${song.isLocal ? 'Local' : 'Pack'}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderSetlist() {
  const items = state.setlist.songIds.map((songId, index) => ({ index, songId, song: findSong(songId, true) }));
  elements.setlistTitleInput.value = state.setlist.title || 'Meu repertório';
  elements.setlistCountBadge.textContent = `${items.length} faixas`;

  if (!items.length) {
    elements.setlistGrid.innerHTML = `
      <article class="empty-state">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><path d="M5 5h14v4H5Zm0 5h14v4H5Zm0 5h14v4H5Z"/></svg>
        </div>
        <h3>Seu repertório está vazio</h3>
        <p>Adicione músicas da biblioteca para criar a ordem do ensaio, culto ou show.</p>
      </article>
    `;
    return;
  }

  elements.setlistGrid.innerHTML = items
    .map(({ index, songId, song }) => {
      if (!song) {
        return `
          <article class="setlist-item">
            <div class="setlist-item__top">
              <span class="setlist-item__index">${index + 1}</span>
              <div>
                <h3 class="setlist-item__title">Conteúdo indisponível</h3>
                <div class="muted">ID ${songId}</div>
              </div>
            </div>
            <p class="setlist-item__excerpt">Ative o pack correspondente ou remova esta faixa da ordem atual.</p>
            <div class="setlist-item__actions">
              <button class="pill-button pill-button--ghost" type="button" data-setlist-action="remove" data-index="${index}">Remover</button>
            </div>
          </article>
        `;
      }

      const isCurrent = index === state.currentSetIndex;
      const title = escapeHTML(song.title);
      const artist = escapeHTML(song.artist);
      const excerptText = escapeHTML(excerpt(song.notes || song.content || 'Sem observações.', 150));
      const cue = escapeHTML(String(song.shortcuts?.cue || index + 1));
      return `
        <article class="setlist-item">
          <div class="setlist-item__top">
            <span class="setlist-item__index">${index + 1}</span>
            <div>
              <h3 class="setlist-item__title">${title}</h3>
              <div class="muted">${artist}</div>
            </div>
            ${isCurrent ? '<span class="status-pill status-pill--live">Atual</span>' : ''}
          </div>
          <div class="setlist-item__meta">${buildMetaChips(song)}</div>
          <p class="setlist-item__excerpt">${excerptText}</p>
          <div class="setlist-item__footer">
            <div class="setlist-item__actions">
              <button class="pill-button" type="button" data-setlist-action="play" data-index="${index}">Abrir</button>
              <button class="pill-button pill-button--ghost" type="button" data-setlist-action="up" data-index="${index}">Subir</button>
              <button class="pill-button pill-button--ghost" type="button" data-setlist-action="down" data-index="${index}">Descer</button>
              <button class="pill-button pill-button--ghost" type="button" data-setlist-action="remove" data-index="${index}">Remover</button>
            </div>
            <span class="badge">Cue ${cue}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderShortcutRows(target, compact = false) {
  target.innerHTML = SHORTCUTS.map(
    (shortcut) => `
      <div class="keyboard-row">
        <div>
          <strong>${shortcut.action}</strong>
        </div>
        <kbd>${compact ? shortcut.key.split(' ')[0] : shortcut.key}</kbd>
      </div>
    `
  ).join('');
}

async function loadStagePdf(song) {
  clearStagePdfUrl();
  elements.stagePdf.classList.add('hidden');
  elements.stageText.classList.add('hidden');
  elements.stageText.textContent = '';
  elements.stageModeBadge.textContent = 'Carregando PDF';

  let nextUrl = song.pdfUrl || '';
  if (!nextUrl && song.assetRef?.id) {
    const asset = await getPdfAsset(song.assetRef.id);
    if (asset?.file) {
      nextUrl = URL.createObjectURL(asset.file);
    }
  }

  if (!nextUrl || state.selectedSongId !== song.id) {
    if (nextUrl?.startsWith('blob:')) URL.revokeObjectURL(nextUrl);
    elements.stageModeBadge.textContent = 'PDF indisponível';
    elements.stagePlaceholder.classList.remove('hidden');
    elements.stageScrollArea.classList.add('hidden');
    showToast('Não foi possível abrir este PDF no navegador.', 'error');
    return;
  }

  state.currentPdfUrl = nextUrl;
  elements.stagePdf.src = nextUrl;
  elements.stagePdf.classList.remove('hidden');
  elements.stageScrollArea.classList.remove('hidden');
  elements.stagePlaceholder.classList.add('hidden');
  elements.stageModeBadge.textContent = 'PDF pronto';
}

async function renderStage() {
  const song = state.selectedSongId ? findSong(state.selectedSongId, true) : null;
  elements.autoscrollBadge.textContent = state.autoScrollTimer ? 'Scroll on' : 'Scroll off';

  if (!song) {
    clearStagePdfUrl();
    elements.stageSongTitle.textContent = 'Nenhuma música selecionada';
    elements.stageSongMeta.innerHTML = '';
    elements.stageModeBadge.textContent = 'Aguardando';
    elements.stagePlaceholder.classList.remove('hidden');
    elements.stageScrollArea.classList.add('hidden');
    elements.stagePdf.classList.add('hidden');
    elements.stageText.classList.add('hidden');
    elements.stageQueue.innerHTML = state.setlist.songIds.length
      ? `<div class="list-row"><div class="list-row__content"><strong>Pronto para começar</strong><span>Use o botão “Começar set” para abrir a primeira faixa.</span></div></div>`
      : `<div class="list-row"><div class="list-row__content"><strong>Sem fila ativa</strong><span>Monte um repertório ou abra uma música da biblioteca.</span></div></div>`;
    return;
  }

  elements.stageSongTitle.textContent = song.title;
  const setPosition = state.currentSetIndex >= 0 ? `${state.currentSetIndex + 1}/${state.setlist.songIds.length}` : 'Solo';
  elements.stageSongMeta.innerHTML = buildMetaChips(song, { extra: [`<span class="badge">${setPosition}</span>`] });

  if (song.type === 'pdf') {
    await loadStagePdf(song);
  } else {
    clearStagePdfUrl();
    const content = transposeSongContent(song.content || '', state.ui.transpose || 0, song.key || 'C');
    const notes = song.notes ? `# Notas de palco\n${song.notes}\n\n` : '';
    elements.stageText.textContent = `${notes}${content}`.trim();
    elements.stageText.style.fontSize = `${clamp(1.02 * (state.ui.fontScale || 1), 0.9, 2.6)}rem`;
    elements.stageText.classList.remove('hidden');
    elements.stagePdf.classList.add('hidden');
    elements.stageScrollArea.classList.remove('hidden');
    elements.stagePlaceholder.classList.add('hidden');
    elements.stageModeBadge.textContent = 'Texto pronto';
  }

  const queueItems = state.setlist.songIds.map((songId, index) => ({ song: findSong(songId, true), index })).filter(({ song }) => Boolean(song));
  if (!queueItems.length) {
    elements.stageQueue.innerHTML = `<div class="list-row"><div class="list-row__content"><strong>Execução avulsa</strong><span>Esta música foi aberta fora de um repertório.</span></div></div>`;
  } else {
    elements.stageQueue.innerHTML = queueItems
      .map(({ song: queueSong, index }) => {
        const title = `${index === state.currentSetIndex ? '▶ ' : ''}${escapeHTML(queueSong.title)}`;
        const subtitle = `${escapeHTML(queueSong.artist)} • ${escapeHTML(getSongDisplayKey(queueSong, index === state.currentSetIndex ? state.ui.transpose : 0))}`;
        return `
          <div class="list-row">
            <div class="list-row__content">
              <strong>${title}</strong>
              <span>${subtitle}</span>
            </div>
            <div class="list-row__actions">
              <button class="pill-button pill-button--ghost" type="button" data-stage-queue="${index}">${index === state.currentSetIndex ? 'Atual' : 'Abrir'}</button>
            </div>
          </div>
        `;
      })
      .join('');
  }
}

function renderPacks() {
  elements.packGrid.innerHTML = state.snapshot.packs
    .map((pack) => {
      const packName = escapeHTML(pack.name);
      const packVersionLabel = escapeHTML(packLabel(pack.version));
      const packId = escapeHTML(pack.id);
      const packAuthor = escapeHTML(pack.author || 'Palco Pro');
      const packDescription = escapeHTML(pack.description || '');
      const actionButton = pack.required
        ? `<button class="pill-button pill-button--ghost" type="button" disabled>Core ativo</button>`
        : `<button class="pill-button ${pack.active ? 'pill-button--ghost' : ''}" type="button" data-pack-action="toggle" data-pack-id="${pack.id}">${pack.active ? 'Desativar' : 'Ativar'}</button>`;

      const localActions = pack.isLocal
        ? `
          <button class="pill-button pill-button--ghost" type="button" data-pack-action="export" data-pack-id="${pack.id}">Exportar</button>
          ${pack.id !== 'local-admin' ? `<button class="pill-button pill-button--danger" type="button" data-pack-action="delete" data-pack-id="${pack.id}">Excluir</button>` : ''}
          <button class="pill-button pill-button--ghost" type="button" data-pack-action="edit" data-pack-id="${pack.id}">Editar</button>
        `
        : '';

      return `
        <article class="pack-card">
          <div class="pack-card__top">
            <div>
              <h3 class="pack-card__title">${packName}</h3>
              <div class="muted">${packVersionLabel} • ${pack.isLocal ? 'Local' : 'Embutido'}</div>
            </div>
            <span class="status-pill ${pack.active ? 'status-pill--live' : ''}">${pack.active ? 'Ativo' : 'Inativo'}</span>
          </div>
          <div class="pack-card__meta">
            <span class="badge">${pack.songCount} músicas</span>
            <span class="badge">${packId}</span>
            <span class="badge">${packAuthor}</span>
          </div>
          <p class="pack-card__description">${packDescription}</p>
          <div class="pack-card__footer">
            <div class="pack-card__actions">
              ${actionButton}
              ${localActions}
            </div>
            <span class="badge">Manifesto modular</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function populateSongPackOptions() {
  const options = (state.snapshot.localPacks || []).map(
    (pack) => `<option value="${pack.id}">${pack.name} (${pack.id})</option>`
  );
  elements.songPackInput.innerHTML = options.join('');
}

function renderAdminSongList() {
  const songs = (state.snapshot.localPacks || []).flatMap((pack) => pack.songs || []);
  if (!songs.length) {
    elements.adminSongList.innerHTML = `<div class="list-row"><div class="list-row__content"><strong>Nenhuma música local ainda</strong><span>Use o formulário ao lado para criar ou importar conteúdo.</span></div></div>`;
    return;
  }

  elements.adminSongList.innerHTML = songs
    .map((song) => {
      const title = escapeHTML(song.title);
      const subtitle = `${escapeHTML(song.artist)} • ${escapeHTML(song.packName)} • ${escapeHTML(formatSongType(song.type))}`;
      return `
        <div class="list-row">
          <div class="list-row__content">
            <strong>${title}</strong>
            <span>${subtitle}</span>
          </div>
          <div class="list-row__actions">
            <button class="pill-button pill-button--ghost" type="button" data-admin-song-action="edit" data-song-id="${song.id}">Editar</button>
            <button class="pill-button pill-button--ghost" type="button" data-admin-song-action="open" data-song-id="${song.id}">Palco</button>
            <button class="pill-button pill-button--danger" type="button" data-admin-song-action="delete" data-song-id="${song.id}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAdminPackList() {
  const packs = state.snapshot.localPacks || [];
  elements.adminPackList.innerHTML = packs
    .map((pack) => {
      const title = escapeHTML(pack.name);
      const subtitle = `${escapeHTML(pack.id)} • ${pack.songCount || pack.songs.length} músicas • ${escapeHTML(packLabel(pack.version))}`;
      return `
        <div class="list-row">
          <div class="list-row__content">
            <strong>${title}</strong>
            <span>${subtitle}</span>
          </div>
          <div class="list-row__actions">
            <button class="pill-button pill-button--ghost" type="button" data-admin-pack-action="edit" data-pack-id="${pack.id}">Editar</button>
            <button class="pill-button pill-button--ghost" type="button" data-admin-pack-action="export" data-pack-id="${pack.id}">Exportar</button>
            ${pack.id !== 'local-admin' ? `<button class="pill-button pill-button--danger" type="button" data-admin-pack-action="delete" data-pack-id="${pack.id}">Excluir</button>` : ''}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAdminVisibility() {
  elements.adminLoginCard.classList.toggle('hidden', state.adminLoggedIn);
  elements.adminPanel.classList.toggle('hidden', !state.adminLoggedIn);
}

function renderAdminTabs() {
  elements.adminTabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.adminTab === state.adminTab);
  });

  elements.adminTabSongs.classList.toggle('hidden', state.adminTab !== 'songs');
  elements.adminTabPacks.classList.toggle('hidden', state.adminTab !== 'packs');
  elements.adminTabSettings.classList.toggle('hidden', state.adminTab !== 'settings');
}

function toggleSongTypeFields() {
  const isPdf = elements.songTypeInput.value === 'pdf';
  elements.songTextWrapper.classList.toggle('hidden', isPdf);
  elements.songPdfWrapper.classList.toggle('hidden', !isPdf);
}

function resetSongForm() {
  elements.songEditId.value = '';
  elements.songTitleInput.value = '';
  elements.songArtistInput.value = '';
  elements.songKeyInput.value = '';
  elements.songBpmInput.value = '';
  elements.songTypeInput.value = 'text';
  elements.songContentInput.value = '';
  elements.songNotesInput.value = '';
  elements.songTagsInput.value = '';
  elements.songPdfInput.value = '';
  elements.songPdfLabel.textContent = 'Nenhum PDF enviado';
  state.pendingPdfFile = null;
  if (elements.songPackInput.options.length) {
    elements.songPackInput.value = 'local-admin';
  }
  elements.duplicateSongButton.classList.add('hidden');
  toggleSongTypeFields();
}

function resetPackForm() {
  elements.packIdInput.value = '';
  elements.packNameInput.value = '';
  elements.packVersionInput.value = '1.0.0';
  elements.packColorInput.value = '#7c5cff';
  elements.packDescriptionInput.value = '';
}

function fillSongForm(song, duplicate = false) {
  elements.songEditId.value = duplicate ? '' : song.id;
  elements.songTitleInput.value = song.title || '';
  elements.songArtistInput.value = song.artist || '';
  elements.songKeyInput.value = song.key || '';
  elements.songBpmInput.value = song.bpm || '';
  elements.songTypeInput.value = song.type || 'text';
  elements.songContentInput.value = song.content || '';
  elements.songNotesInput.value = song.notes || '';
  elements.songTagsInput.value = (song.tags || []).join(', ');
  elements.songPackInput.value = song.isLocal ? song.packId : 'local-admin';
  elements.songPdfLabel.textContent = song.assetRef?.name || song.pdfUrl || 'Nenhum PDF enviado';
  state.pendingPdfFile = null;
  elements.duplicateSongButton.classList.toggle('hidden', duplicate || !song.isLocal);
  toggleSongTypeFields();
}

function fillPackForm(pack) {
  elements.packIdInput.value = pack.id || '';
  elements.packNameInput.value = pack.name || '';
  elements.packVersionInput.value = pack.version || '1.0.0';
  elements.packColorInput.value = pack.themeAccent || '#7c5cff';
  elements.packDescriptionInput.value = pack.description || '';
}

function renderAdmin() {
  renderAdminVisibility();
  renderAdminTabs();
  populateSongPackOptions();
  renderAdminSongList();
  renderAdminPackList();
  toggleSongTypeFields();
}

function renderAll() {
  elements.searchInput.value = state.ui.search || '';
  renderRoute();
  renderMetrics();
  renderFilters();
  renderLibrary();
  renderSetlist();
  renderPacks();
  renderAdmin();
  renderShortcutRows(elements.shortcutList, false);
  renderShortcutRows(elements.shortcutPreview, true);
  renderStage();
}

async function refreshContent() {
  state.snapshot = await contentManager.load();

  if (state.selectedSongId && !findSong(state.selectedSongId, true)) {
    state.selectedSongId = null;
    state.currentSetIndex = -1;
  }

  renderAll();
}

function addToSetlist(songId) {
  state.setlist.songIds.push(songId);
  if (!state.setlist.title) state.setlist.title = 'Meu repertório';
  persistSetlist();
  renderMetrics();
  renderSetlist();
  renderStage();
  showToast('Música adicionada ao repertório.', 'success');
}

function removeFromSetlist(index) {
  const [removedSongId] = state.setlist.songIds.splice(index, 1);
  if (index === state.currentSetIndex) {
    const nextSongId = state.setlist.songIds[index] || state.setlist.songIds[index - 1] || null;
    state.selectedSongId = nextSongId;
    state.currentSetIndex = nextSongId ? Math.max(0, Math.min(index, state.setlist.songIds.length - 1)) : -1;
  } else if (index < state.currentSetIndex) {
    state.currentSetIndex -= 1;
  }
  persistSetlist();
  renderMetrics();
  renderSetlist();
  renderStage();
  if (removedSongId) showToast('Faixa removida do repertório.', 'success');
}

function moveSetlistItem(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.setlist.songIds.length) return;
  const songIds = [...state.setlist.songIds];
  [songIds[index], songIds[nextIndex]] = [songIds[nextIndex], songIds[index]];
  state.setlist.songIds = songIds;

  if (state.currentSetIndex === index) state.currentSetIndex = nextIndex;
  else if (state.currentSetIndex === nextIndex) state.currentSetIndex = index;

  persistSetlist();
  renderSetlist();
  renderStage();
}

function openSongInStage(songId, options = {}) {
  const song = findSong(songId, true);
  if (!song) {
    showToast('Essa música não está disponível no conteúdo carregado.', 'error');
    return;
  }

  state.selectedSongId = songId;
  if (typeof options.setIndex === 'number') {
    state.currentSetIndex = options.setIndex;
  } else if (state.setlist.songIds.includes(songId)) {
    setCurrentSetIndexBySong(songId);
  } else {
    state.currentSetIndex = -1;
  }

  if (options.route !== false) setRoute('palco');
  renderMetrics();
  renderStage();
}

function openDialog({ title, body, primaryLabel = 'Fechar', secondaryLabel = 'Cancelar', onPrimary = null }) {
  elements.dialogTitle.textContent = title;
  elements.dialogBody.innerHTML = body;
  elements.dialogPrimary.textContent = primaryLabel;
  elements.dialogSecondary.textContent = secondaryLabel;
  state.dialogAction = onPrimary;
  elements.dialogBackdrop.classList.add('is-open');
  elements.dialogBackdrop.setAttribute('aria-hidden', 'false');
}

function closeDialog() {
  elements.dialogBackdrop.classList.remove('is-open');
  elements.dialogBackdrop.setAttribute('aria-hidden', 'true');
  state.dialogAction = null;
}

function showSongPreview(songId) {
  const song = findSong(songId, true);
  if (!song) return;
  const previewContent = song.type === 'pdf'
    ? '<p>Arquivo PDF pronto para abrir em modo palco. Se o navegador do dispositivo suportar, ele é exibido embutido; caso contrário, pode ser aberto em nova aba.</p>'
    : `<pre class="stage-viewer__text" style="font-size: 1rem">${escapeHTML((song.content || '').slice(0, 900))}</pre>`;

  openDialog({
    title: song.title,
    body: `
      <div class="panel">
        <div class="stage-card__meta">${buildMetaChips(song)}</div>
        <p>${escapeHTML(song.notes || 'Sem observações de palco.')}</p>
        ${previewContent}
      </div>
    `,
    primaryLabel: 'Abrir no palco',
    secondaryLabel: 'Fechar',
    onPrimary: () => openSongInStage(song.id)
  });
}

function showQuickGuide() {
  openDialog({
    title: 'Guia rápido de palco',
    body: `
      <div class="panel">
        <p>Atalhos prontos para notebook, desktop ou tablet com teclado. No celular, use toque e swipe lateral no painel do palco.</p>
        <div class="keyboard-grid">
          ${SHORTCUTS.map(
            (shortcut) => `
              <div class="keyboard-row">
                <strong>${shortcut.action}</strong>
                <kbd>${shortcut.key}</kbd>
              </div>
            `
          ).join('')}
        </div>
      </div>
    `,
    primaryLabel: 'Ir para o palco',
    secondaryLabel: 'Fechar',
    onPrimary: () => setRoute('palco')
  });
}

function exportSetlist() {
  downloadJSON('palco-pro-setlist.json', {
    schema: 'palco-pro-setlist/v1',
    exportedAt: new Date().toISOString(),
    setlist: state.setlist
  });
  showToast('Repertório exportado em JSON.', 'success');
}

async function exportLocalPacks() {
  const packs = [];
  for (const pack of state.snapshot.localPacks || []) {
    packs.push(await contentManager.exportPack(pack.id));
  }
  downloadJSON('palco-pro-packs.json', {
    schema: 'palco-pro-packs/v1',
    exportedAt: new Date().toISOString(),
    packs
  });
  showToast('Packs locais exportados.', 'success');
}

async function exportBackup() {
  const backup = await contentManager.exportBackup();
  downloadJSON('palco-pro-backup.json', backup);
  showToast('Backup completo exportado.', 'success');
}

function handleSongAction(action, songId) {
  switch (action) {
    case 'preview':
      showSongPreview(songId);
      break;
    case 'add':
      addToSetlist(songId);
      break;
    case 'open':
      openSongInStage(songId);
      break;
    default:
      break;
  }
}

function handleSetlistAction(action, index) {
  switch (action) {
    case 'play':
      openSongInStage(state.setlist.songIds[index], { setIndex: index });
      break;
    case 'up':
      moveSetlistItem(index, -1);
      break;
    case 'down':
      moveSetlistItem(index, 1);
      break;
    case 'remove':
      removeFromSetlist(index);
      break;
    default:
      break;
  }
}

async function handlePackAction(action, packId) {
  const pack = state.snapshot.packs.find((item) => item.id === packId);
  if (!pack) return;

  switch (action) {
    case 'toggle':
      state.snapshot = contentManager.togglePack(packId, !pack.active);
      renderAll();
      showToast(`Pack ${pack.active ? 'desativado' : 'ativado'} com sucesso.`, 'success');
      break;
    case 'export': {
      const payload = await contentManager.exportPack(packId);
      downloadJSON(`${packId}.json`, payload);
      showToast('Pack exportado.', 'success');
      break;
    }
    case 'delete': {
      const confirmed = window.confirm(`Excluir o pack "${pack.name}"?`);
      if (!confirmed) return;
      await contentManager.deletePack(packId);
      await refreshContent();
      showToast('Pack local excluído.', 'success');
      break;
    }
    case 'edit':
      fillPackForm(pack);
      state.adminTab = 'packs';
      setRoute('admin');
      renderAdmin();
      break;
    default:
      break;
  }
}

async function handleAdminSongAction(action, songId) {
  const song = getLocalSong(songId);
  if (!song) return;

  switch (action) {
    case 'edit':
      fillSongForm(song, false);
      state.adminTab = 'songs';
      setRoute('admin');
      renderAdmin();
      break;
    case 'open':
      openSongInStage(songId);
      break;
    case 'delete': {
      const confirmed = window.confirm(`Excluir a música "${song.title}"?`);
      if (!confirmed) return;
      await contentManager.deleteSong(songId);
      await refreshContent();
      if (state.selectedSongId === songId) {
        state.selectedSongId = null;
        state.currentSetIndex = -1;
      }
      removeOrphanedSongsFromSetlist();
      showToast('Música local excluída.', 'success');
      break;
    }
    default:
      break;
  }
}

async function handleAdminPackAction(action, packId) {
  switch (action) {
    case 'edit': {
      const pack = getLocalPack(packId);
      if (pack) {
        fillPackForm(pack);
        state.adminTab = 'packs';
        renderAdmin();
      }
      break;
    }
    case 'export': {
      const pack = await contentManager.exportPack(packId);
      downloadJSON(`${packId}.json`, pack);
      showToast('Pack exportado.', 'success');
      break;
    }
    case 'delete': {
      const confirmed = window.confirm('Deseja excluir este pack local?');
      if (!confirmed) return;
      await contentManager.deletePack(packId);
      await refreshContent();
      removeOrphanedSongsFromSetlist();
      showToast('Pack local excluído.', 'success');
      break;
    }
    default:
      break;
  }
}

function removeOrphanedSongsFromSetlist() {
  state.setlist.songIds = state.setlist.songIds.filter((songId) => findSong(songId, true));
  if (state.currentSetIndex >= state.setlist.songIds.length) state.currentSetIndex = state.setlist.songIds.length - 1;
  persistSetlist();
  renderMetrics();
  renderSetlist();
  renderStage();
}

async function saveSongFromForm(duplicate = false) {
  const currentSong = duplicate ? null : getLocalSong(elements.songEditId.value);
  const type = elements.songTypeInput.value;
  const packId = elements.songPackInput.value || 'local-admin';

  if (!elements.songTitleInput.value.trim()) {
    showToast('Informe ao menos o título da música.', 'error');
    return;
  }

  let assetRef = currentSong?.assetRef || null;
  if (type === 'pdf') {
    if (state.pendingPdfFile) {
      assetRef = await savePdfAsset(state.pendingPdfFile);
    }
    if (!assetRef && !currentSong?.pdfUrl) {
      showToast('Envie um arquivo PDF para músicas do tipo PDF.', 'error');
      return;
    }
  } else {
    assetRef = null;
  }

  state.snapshot = await contentManager.upsertSong({
    id: duplicate ? '' : elements.songEditId.value,
    title: elements.songTitleInput.value.trim(),
    artist: elements.songArtistInput.value.trim(),
    key: elements.songKeyInput.value.trim(),
    bpm: elements.songBpmInput.value,
    type,
    packId,
    content: type === 'text' ? elements.songContentInput.value : '',
    notes: elements.songNotesInput.value,
    tags: normalizeArray(elements.songTagsInput.value),
    assetRef,
    pdfUrl: currentSong?.pdfUrl || '',
    format: type === 'pdf' ? 'partitura' : 'cifra'
  });

  renderAll();
  resetSongForm();
  showToast(duplicate ? 'Música duplicada com sucesso.' : 'Música salva com sucesso.', 'success');
}

function savePackFromForm() {
  const id = elements.packIdInput.value.trim();
  const name = elements.packNameInput.value.trim();
  if (!id && !name) {
    showToast('Informe o ID ou nome do pack.', 'error');
    return;
  }

  state.snapshot = contentManager.upsertPack({
    id,
    name: name || id,
    version: elements.packVersionInput.value.trim() || '1.0.0',
    description: elements.packDescriptionInput.value.trim(),
    themeAccent: elements.packColorInput.value.trim() || '#7c5cff'
  });

  renderAll();
  showToast('Pack salvo com sucesso.', 'success');
}

async function importJsonByAction(file) {
  const payload = await readJsonFile(file);

  switch (state.pendingImportAction) {
    case 'setlist': {
      const incoming = payload.setlist || payload;
      if (!(Array.isArray(incoming.songIds))) {
        throw new Error('JSON de repertório inválido.');
      }
      state.setlist = {
        title: incoming.title || 'Meu repertório',
        songIds: incoming.songIds,
        updatedAt: new Date().toISOString()
      };
      persistSetlist();
      renderMetrics();
      renderSetlist();
      renderStage();
      showToast('Repertório importado.', 'success');
      break;
    }
    case 'pack':
      await contentManager.installPack(payload);
      await refreshContent();
      showToast('Pack instalado com sucesso.', 'success');
      break;
    case 'backup':
      await contentManager.importBackup(payload);
      state.setlist = localStore.getSetlist();
      state.ui = localStore.getUI();
      await refreshContent();
      showToast('Backup restaurado.', 'success');
      break;
    default:
      break;
  }
}

function toggleAutoscroll() {
  const scrollArea = elements.stageScrollArea;
  if (state.autoScrollTimer) {
    window.clearInterval(state.autoScrollTimer);
    state.autoScrollTimer = null;
    renderStage();
    return;
  }

  state.autoScrollTimer = window.setInterval(() => {
    scrollArea.scrollBy({ top: 1.6 * (state.ui.scrollSpeed || 1), behavior: 'auto' });
    if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 4) {
      window.clearInterval(state.autoScrollTimer);
      state.autoScrollTimer = null;
      renderStage();
    }
  }, 26);

  renderStage();
}

function stepFont(direction) {
  state.ui.fontScale = clamp((state.ui.fontScale || 1) + direction * 0.08, 0.8, 2.4);
  persistUI();
  renderStage();
}

function stepTranspose(direction) {
  state.ui.transpose = clamp((state.ui.transpose || 0) + direction, -6, 6);
  persistUI();
  renderStage();
}

function advanceSong(direction) {
  if (state.setlist.songIds.length && state.currentSetIndex >= 0) {
    const nextIndex = state.currentSetIndex + direction;
    if (nextIndex >= 0 && nextIndex < state.setlist.songIds.length) {
      openSongInStage(state.setlist.songIds[nextIndex], { setIndex: nextIndex, route: false });
      renderStage();
      return;
    }
  }

  const songs = filteredSongs().length ? filteredSongs() : state.snapshot.songs;
  const currentIndex = songs.findIndex((song) => song.id === state.selectedSongId);
  const nextSong = songs[currentIndex + direction];
  if (nextSong) {
    openSongInStage(nextSong.id, { route: false });
    renderStage();
  }
}

async function toggleFullscreen() {
  const target = elements.stageViewer;
  if (!document.fullscreenElement) {
    await target.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}

function buildDemoSetlist() {
  const demoIds = state.snapshot.songs.slice(0, 4).map((song) => song.id);
  if (!demoIds.length) {
    showToast('Não há músicas suficientes para montar o repertório demo.', 'error');
    return;
  }

  state.setlist = {
    title: 'Set demo mobile-first',
    songIds: demoIds,
    updatedAt: new Date().toISOString()
  };
  persistSetlist();
  renderMetrics();
  renderSetlist();
  renderStage();
  showToast('Repertório demo criado.', 'success');
}

function bindEvents() {
  elements.routeButtons.forEach((button) => {
    button.addEventListener('click', () => setRoute(button.dataset.route));
  });

  document.querySelectorAll('[data-route-jump]').forEach((button) => {
    button.addEventListener('click', () => setRoute(button.dataset.routeJump));
  });

  elements.searchInput.value = state.ui.search || '';
  elements.searchInput.addEventListener('input', (event) => {
    state.ui.search = event.target.value;
    persistUI();
    renderLibrary();
  });

  elements.filterRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.ui.filter = button.dataset.filter;
    persistUI();
    renderFilters();
    renderLibrary();
  });

  elements.libraryGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-song-action]');
    if (button) {
      handleSongAction(button.dataset.songAction, button.dataset.songId);
      return;
    }

    const card = event.target.closest('[data-song-card]');
    if (card) showSongPreview(card.dataset.songCard);
  });

  elements.setlistGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-setlist-action]');
    if (!button) return;
    handleSetlistAction(button.dataset.setlistAction, Number(button.dataset.index));
  });

  elements.packGrid.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-pack-action]');
    if (!button) return;
    await handlePackAction(button.dataset.packAction, button.dataset.packId);
  });

  elements.adminSongList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-admin-song-action]');
    if (!button) return;
    await handleAdminSongAction(button.dataset.adminSongAction, button.dataset.songId);
  });

  elements.adminPackList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-admin-pack-action]');
    if (!button) return;
    await handleAdminPackAction(button.dataset.adminPackAction, button.dataset.packId);
  });

  elements.adminLoginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = elements.adminPasswordInput.value;
    if (password !== localStore.getAdminPassword()) {
      showToast('Senha inválida.', 'error');
      return;
    }
    state.adminLoggedIn = true;
    localStore.setAdminSession(true);
    renderAdminVisibility();
    showToast('Admin liberado.', 'success');
    elements.adminPasswordInput.value = '';
  });

  elements.adminTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.adminTab = button.dataset.adminTab;
      renderAdminTabs();
    });
  });

  document.querySelector('#adminLogoutButton')?.addEventListener('click', () => {
    state.adminLoggedIn = false;
    localStore.setAdminSession(false);
    renderAdminVisibility();
    showToast('Sessão admin encerrada.');
  });

  document.querySelector('#saveSongButton')?.addEventListener('click', () => saveSongFromForm(false).catch((error) => showToast(error.message, 'error')));
  document.querySelector('#resetSongButton')?.addEventListener('click', resetSongForm);
  elements.duplicateSongButton.addEventListener('click', () => saveSongFromForm(true).catch((error) => showToast(error.message, 'error')));

  document.querySelector('#savePackButton')?.addEventListener('click', savePackFromForm);
  document.querySelector('#resetPackButton')?.addEventListener('click', resetPackForm);

  document.querySelector('#savePasswordButton')?.addEventListener('click', () => {
    const nextPassword = elements.newPasswordInput.value.trim();
    if (!nextPassword || nextPassword.length < 4) {
      showToast('Use uma senha com pelo menos 4 caracteres.', 'error');
      return;
    }
    localStore.setAdminPassword(nextPassword);
    elements.newPasswordInput.value = '';
    showToast('Senha local atualizada.', 'success');
  });

  document.querySelector('#backupButton')?.addEventListener('click', () => exportBackup().catch((error) => showToast(error.message, 'error')));
  document.querySelector('#restoreButton')?.addEventListener('click', () => {
    state.pendingImportAction = 'backup';
    elements.hiddenImportInput.click();
  });

  document.querySelector('#wipeLocalButton')?.addEventListener('click', async () => {
    const confirmed = window.confirm('Limpar todos os dados locais do navegador? O conteúdo embutido permanece intacto.');
    if (!confirmed) return;
    localStore.clearLocalData();
    await clearPdfAssets();
    state.setlist = localStore.getSetlist();
    state.ui = localStore.getUI();
    state.adminLoggedIn = false;
    state.selectedSongId = null;
    state.currentSetIndex = -1;
    await refreshContent();
    resetSongForm();
    resetPackForm();
    showToast('Dados locais removidos.', 'success');
  });

  elements.songTypeInput.addEventListener('change', toggleSongTypeFields);
  elements.songPdfInput.addEventListener('change', (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    state.pendingPdfFile = file;
    elements.songPdfLabel.textContent = `${file.name} • ${(file.size / 1024).toFixed(1)} KB`;
  });

  elements.setlistTitleInput.addEventListener('input', (event) => {
    state.setlist.title = event.target.value;
    persistSetlist();
  });

  document.querySelector('#startSetButton')?.addEventListener('click', () => {
    if (!state.setlist.songIds.length) {
      showToast('Adicione músicas ao repertório antes de começar.', 'error');
      return;
    }
    openSongInStage(state.setlist.songIds[0], { setIndex: 0 });
  });

  document.querySelector('#clearSetButton')?.addEventListener('click', () => {
    state.setlist.songIds = [];
    state.currentSetIndex = -1;
    persistSetlist();
    renderMetrics();
    renderSetlist();
    renderStage();
    showToast('Repertório limpo.');
  });

  document.querySelector('#exportSetButton')?.addEventListener('click', exportSetlist);
  document.querySelector('#importSetButton')?.addEventListener('click', () => {
    state.pendingImportAction = 'setlist';
    elements.hiddenImportInput.click();
  });

  document.querySelector('#addDemoToSetlist')?.addEventListener('click', buildDemoSetlist);
  document.querySelector('#openQuickGuide')?.addEventListener('click', showQuickGuide);
  document.querySelector('#showGuideInline')?.addEventListener('click', showQuickGuide);
  document.querySelector('#exportLibraryButton')?.addEventListener('click', () => exportBackup().catch((error) => showToast(error.message, 'error')));

  document.querySelector('#importPackButton')?.addEventListener('click', () => {
    state.pendingImportAction = 'pack';
    elements.hiddenImportInput.click();
  });

  document.querySelector('#createPackButton')?.addEventListener('click', () => {
    state.adminTab = 'packs';
    resetPackForm();
    setRoute('admin');
    renderAdmin();
  });

  document.querySelector('#reloadPacksButton')?.addEventListener('click', () => refreshContent().catch((error) => showToast(error.message, 'error')));
  document.querySelector('#exportAllPacksButton')?.addEventListener('click', () => exportLocalPacks().catch((error) => showToast(error.message, 'error')));

  document.querySelector('#prevSongButton')?.addEventListener('click', () => advanceSong(-1));
  document.querySelector('#nextSongButton')?.addEventListener('click', () => advanceSong(1));
  document.querySelector('#fontDownButton')?.addEventListener('click', () => stepFont(-1));
  document.querySelector('#fontUpButton')?.addEventListener('click', () => stepFont(1));
  document.querySelector('#transposeDownButton')?.addEventListener('click', () => stepTranspose(-1));
  document.querySelector('#transposeUpButton')?.addEventListener('click', () => stepTranspose(1));
  document.querySelector('#scrollToggleButton')?.addEventListener('click', toggleAutoscroll);
  document.querySelector('#fullscreenButton')?.addEventListener('click', () => toggleFullscreen().catch(() => {}));

  elements.stageQueue.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stage-queue]');
    if (!button) return;
    openSongInStage(state.setlist.songIds[Number(button.dataset.stageQueue)], { setIndex: Number(button.dataset.stageQueue) });
  });

  elements.hiddenImportInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      await importJsonByAction(file);
    } catch (error) {
      showToast(error.message || 'Falha ao importar o JSON.', 'error');
    } finally {
      event.target.value = '';
      state.pendingImportAction = null;
    }
  });

  elements.dialogPrimary.addEventListener('click', () => {
    if (state.dialogAction) state.dialogAction();
    closeDialog();
  });
  elements.dialogSecondary.addEventListener('click', closeDialog);
  document.querySelector('#dialogClose')?.addEventListener('click', closeDialog);
  elements.dialogBackdrop.addEventListener('click', (event) => {
    if (event.target === elements.dialogBackdrop) closeDialog();
  });

  window.addEventListener('keydown', (event) => {
    const targetTag = event.target?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)) return;

    if (state.route !== 'palco') return;

    switch (event.key) {
      case ' ':
      case ']':
        event.preventDefault();
        advanceSong(1);
        break;
      case 'Backspace':
      case '[':
        event.preventDefault();
        advanceSong(-1);
        break;
      case '+':
      case '=':
        event.preventDefault();
        stepFont(1);
        break;
      case '-':
      case '_':
        event.preventDefault();
        stepFont(-1);
        break;
      case 't':
      case 'T':
        event.preventDefault();
        stepTranspose(1);
        break;
      case 'g':
      case 'G':
        event.preventDefault();
        stepTranspose(-1);
        break;
      case 's':
      case 'S':
        event.preventDefault();
        toggleAutoscroll();
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        toggleFullscreen().catch(() => {});
        break;
      default:
        break;
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;
  elements.stageViewer.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  elements.stageViewer.addEventListener('touchend', (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) > 72 && Math.abs(deltaY) < 60) {
      if (deltaX < 0) advanceSong(1);
      else advanceSong(-1);
    }
  }, { passive: true });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./service-worker.js');
  } catch (error) {
    console.warn('Falha ao registrar service worker', error);
  }
}

async function init() {
  bindEvents();
  await refreshContent();
  renderRoute();
  renderAdminVisibility();
  if (!state.setlist.title) state.setlist.title = 'Meu repertório';
  elements.setlistTitleInput.value = state.setlist.title;
  resetSongForm();
  resetPackForm();
  await registerServiceWorker();
}

init().catch((error) => {
  console.error(error);
  showToast('O aplicativo encontrou um erro ao iniciar.', 'error');
});
