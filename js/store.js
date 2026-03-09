
const STAGE_MUSIC_KEYS = { publicDraft: 'stage_music_public_draft_v041' };

function readDraftLibrary() {
  try { return JSON.parse(localStorage.getItem(STAGE_MUSIC_KEYS.publicDraft) || '[]'); }
  catch (error) { return []; }
}
function writeDraftLibrary(data) {
  localStorage.setItem(STAGE_MUSIC_KEYS.publicDraft, JSON.stringify(data));
}
