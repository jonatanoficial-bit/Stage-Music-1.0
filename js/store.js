const STAGE_KEYS={
  publicDraft:'stage_music_public_draft_v081',
  savedSetlists:'stage_music_saved_setlists_v081',
  localPdfs:'stage_music_local_pdfs_v081',
  favorites:'stage_music_favorites_v081'
};
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||fallback)}catch(e){return JSON.parse(fallback)}}
function writeJson(key,data){localStorage.setItem(key,JSON.stringify(data))}
function readDraftLibrary(){return readJson(STAGE_KEYS.publicDraft,'[]')}
function writeDraftLibrary(data){writeJson(STAGE_KEYS.publicDraft,data)}
function readSavedSetlists(){return readJson(STAGE_KEYS.savedSetlists,'[]')}
function writeSavedSetlists(data){writeJson(STAGE_KEYS.savedSetlists,data)}
function readLocalPdfs(){return readJson(STAGE_KEYS.localPdfs,'[]')}
function writeLocalPdfs(data){writeJson(STAGE_KEYS.localPdfs,data)}
function readFavorites(){return readJson(STAGE_KEYS.favorites,'[]')}
function writeFavorites(data){writeJson(STAGE_KEYS.favorites,data)}
