
const STAGE_KEYS = {
  savedSetlists: 'stage_music_saved_setlists_v121',
  localPdfs: 'stage_music_local_pdfs_v121',
  favorites: 'stage_music_favorites_v121',
  publicDraft: 'stage_music_public_draft_v121'
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function readSavedSetlists() { return readJson(STAGE_KEYS.savedSetlists, []); }
function writeSavedSetlists(data) { writeJson(STAGE_KEYS.savedSetlists, data); }
function readLocalPdfs() { return readJson(STAGE_KEYS.localPdfs, []); }
function writeLocalPdfs(data) { writeJson(STAGE_KEYS.localPdfs, data); }
function readFavorites() { return readJson(STAGE_KEYS.favorites, []); }
function writeFavorites(data) { writeJson(STAGE_KEYS.favorites, data); }
function readDraftLibrary() { return readJson(STAGE_KEYS.publicDraft, []); }
function writeDraftLibrary(data) { writeJson(STAGE_KEYS.publicDraft, data); }
