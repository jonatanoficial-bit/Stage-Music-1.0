const STAGE_MUSIC_KEYS = { publicDraft: 'stage_music_public_draft_v050', savedSetlists: 'stage_music_saved_setlists_v050' };
function readDraftLibrary(){ try { return JSON.parse(localStorage.getItem(STAGE_MUSIC_KEYS.publicDraft)||'[]'); } catch(e){ return []; } }
function writeDraftLibrary(data){ localStorage.setItem(STAGE_MUSIC_KEYS.publicDraft, JSON.stringify(data)); }
function readSavedSetlists(){ try { return JSON.parse(localStorage.getItem(STAGE_MUSIC_KEYS.savedSetlists)||'[]'); } catch(e){ return []; } }
function writeSavedSetlists(data){ localStorage.setItem(STAGE_MUSIC_KEYS.savedSetlists, JSON.stringify(data)); }