
const STORE={
getLocalPDFs(){return JSON.parse(localStorage.getItem("stage_music_pdfs")||"[]")},
saveLocalPDFs(d){localStorage.setItem("stage_music_pdfs",JSON.stringify(d))},
getSetlist(){return JSON.parse(localStorage.getItem("stage_music_setlist")||"[]")},
saveSetlist(d){localStorage.setItem("stage_music_setlist",JSON.stringify(d))}
}
