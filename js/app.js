
(function () {
  const NOTE_SHARPS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const FLAT_TO_SHARP = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
  const DEFAULT_GENRES = ['gospel','worship','sertanejo','pagode','pop','rock','mpb','forró','instrumental'];
  const DEFAULT_CLASSES = ['culto','adoração','noite','ensaio','acústico','banda','solo','coro'];

  const state = { allSongs: [], filteredSongs: [], selectedId: null, filter: 'all', scrollTimer: null, scrollSpeed: 3, setlist: [], savedSetlists: readSavedSetlists(), favorites: readFavorites(), transpose: 0, mirrored: false, dragIndex: null, touchStartX: 0 };
  const $ = id => document.getElementById(id);
  const dom = {
    libraryList: $('libraryList'), libraryCount: $('libraryCount'), searchInput: $('searchInput'), genreFilter: $('genreFilter'), classificationFilter: $('classificationFilter'),
    viewerTitle: $('viewerTitle'), viewerSubtitle: $('viewerSubtitle'), metaKey: $('metaKey'), metaBpm: $('metaBpm'), metaCapo: $('metaCapo'), metaSource: $('metaSource'),
    viewerContent: $('viewerContent'), viewerCard: $('viewerCard'), fontRange: $('fontRange'), increaseFont: $('increaseFont'), decreaseFont: $('decreaseFont'),
    copyText: $('copyText'), toggleFavorite: $('toggleFavorite'), startScroll: $('startScroll'), scrollSpeed: $('scrollSpeed'), toggleStageMode: $('toggleStageMode'),
    refreshLibrary: $('refreshLibrary'), addToSetlist: $('addToSetlist'), setlistList: $('setlistList'), setlistCount: $('setlistCount'), setlistTitle: $('setlistTitle'),
    setlistSummary: $('setlistSummary'), setlistProgressFill: $('setlistProgressFill'), setlistProgressLabel: $('setlistProgressLabel'), nextSongCard: $('nextSongCard'),
    nextSong: $('nextSong'), prevSong: $('prevSong'), jumpInput: $('jumpInput'), jumpButton: $('jumpButton'), saveSetlist: $('saveSetlist'), clearSetlist: $('clearSetlist'),
    savedPlaylists: $('savedPlaylists'), pdfInput: $('pdfInput'), scrollProgress: $('scrollProgress'), transposeDown: $('transposeDown'), transposeUp: $('transposeUp'),
    toggleMirror: $('toggleMirror'), nowPlayingTitle: $('nowPlayingTitle'), nextPlayingTitle: $('nextPlayingTitle')
  };

  function unregisterOldCaches(){ if('serviceWorker' in navigator){ navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).catch(()=>{}); } if('caches' in window){ caches.keys().then(keys=>keys.forEach(k=>caches.delete(k))).catch(()=>{}); } }
  function esc(v){ return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function currentSong(){ return state.allSongs.find(s=>s.id===state.selectedId) || state.setlist.find(s=>s.id===state.selectedId) || null; }
  function favoriteIds(){ return new Set(state.favorites.map(x=>x.id)); }
  function isFavorite(id){ return favoriteIds().has(id); }
  function toSharp(note){ return FLAT_TO_SHARP[note] || note; }
  function transposeRoot(root, delta){ const idx = NOTE_SHARPS.indexOf(toSharp(root)); return idx === -1 ? root : NOTE_SHARPS[(idx + delta + 120) % 12]; }
  function transposeChordToken(token, delta){ const p = token.split('/'); const left = p[0].replace(/^([A-G](?:#|b)?)/, m => transposeRoot(m, delta)); return p[1] ? `${left}/${transposeRoot(p[1], delta)}` : left; }
  function transposeText(text, delta){ if(!delta) return text; return String(text).replace(/\b([A-G](?:#|b)?(?:m|maj7|7|sus2|sus4|dim|add9|9|11|13)?(?:\/[A-G](?:#|b)?)?)\b/g, m => transposeChordToken(m, delta)); }
  function minutesEstimate(){ return state.setlist.reduce((a,s)=>a + Math.max(4, Math.round((Number(s.bpm)||80)/20)), 0); }
  function normalizeSong(song, origin){
    const tags = Array.isArray(song.tags) ? song.tags : String(song.tags || '').split(',').map(v=>v.trim()).filter(Boolean);
    return { id: song.id || `${origin}-${song.title||'song'}-${song.artist||'artist'}`.toLowerCase().replace(/\s+/g,'-'), title:song.title||'Sem título', artist:song.artist||'Artista não informado', key:song.key||'—', bpm:song.bpm||'—', capo:song.capo||'—', tags, notes:song.notes||'', lyrics:song.lyrics||'', source:origin==='online'?'Online':'Local', sourceType:origin, pdf:song.pdf||'', genre:song.genre || tags.find(t=>DEFAULT_GENRES.includes(String(t).toLowerCase())) || 'sem gênero', classification:song.classification || tags.find(t=>DEFAULT_CLASSES.includes(String(t).toLowerCase())) || 'geral' };
  }
  async function fetchOnlineLibrary(){
    const r = await fetch('content/online-library/manifest.json?b=142', {cache:'no-store'});
    if(!r.ok) throw new Error('manifest.json não encontrado');
    const p = await r.json();
    return (Array.isArray(p.musics)?p.musics:[]).map(s=>normalizeSong(s,'online'));
  }
  function getLocalLibrary(){ return readLocalPdfs().map(item=>normalizeSong({title:item.title,artist:'PDF Local',key:'—',bpm:'—',capo:'—',tags:['pdf','local'],notes:'Arquivo local do músico',lyrics:'',pdf:item.dataUrl,genre:'pdf',classification:'local'},'local')); }
  function populateFilters(){
    if(!dom.genreFilter || !dom.classificationFilter) return;
    const genres = [...new Set([...DEFAULT_GENRES,...state.allSongs.map(s=>s.genre).filter(Boolean)])];
    const classes = [...new Set([...DEFAULT_CLASSES,...state.allSongs.map(s=>s.classification).filter(Boolean)])];
    dom.genreFilter.innerHTML = '<option value="all">Todos os gêneros</option>' + genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
    dom.classificationFilter.innerHTML = '<option value="all">Todas as classificações</option>' + classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
  function highlightLyrics(text){
    return String(text).split('\n').map(line=>{
      const safe=esc(line);
      if(/^[\[(#].+[\])]?$/.test(line.trim())) return `<span class="section">${safe}</span>`;
      return safe.replace(/\b([A-G](#|b)?(m|maj7|7|sus2|sus4|dim|add9|9|11|13)?)(\/([A-G](#|b)?))?\b/g,'<span class="chord">$1</span>');
    }).join('\n');
  }
  function updateFavoriteButton(){ const s=currentSong(); if(dom.toggleFavorite) dom.toggleFavorite.textContent = s && isFavorite(s.id) ? '★' : '☆'; }
  function renderLibrary(){
    if(!dom.libraryList) return;
    const q = dom.searchInput ? dom.searchInput.value.trim().toLowerCase() : '';
    const genre = dom.genreFilter ? dom.genreFilter.value : 'all';
    const cls = dom.classificationFilter ? dom.classificationFilter.value : 'all';
    state.filteredSongs = state.allSongs.filter(song=>{
      const matchesBase = state.filter==='all' || song.sourceType===state.filter || (state.filter==='favorites' && isFavorite(song.id));
      const matchesGenre = genre==='all' || String(song.genre).toLowerCase()===genre.toLowerCase();
      const matchesClass = cls==='all' || String(song.classification).toLowerCase()===cls.toLowerCase();
      const bag=[song.title,song.artist,song.key,song.notes,song.genre,song.classification,song.tags.join(' ')].join(' ').toLowerCase();
      return matchesBase && matchesGenre && matchesClass && bag.includes(q);
    });
    if(dom.libraryCount) dom.libraryCount.textContent=`${state.filteredSongs.length} faixas`;
    if(!state.filteredSongs.length){ dom.libraryList.innerHTML='<div class="empty-state"><div class="empty-icon">⊘</div><p>Nenhuma música encontrada.</p></div>'; return; }
    dom.libraryList.innerHTML = state.filteredSongs.map(song=>`<article class="song-item ${song.id===state.selectedId?'active':''}" data-id="${song.id}"><h3>${esc(song.title)}</h3><p>${esc(song.artist)} • Tom ${esc(song.key)} • ${esc(song.genre)} • ${esc(song.source)}</p><div class="song-tags"><span class="tag">${esc(song.classification)}</span>${isFavorite(song.id)?'<span class="tag">favorita</span>':''}${(song.tags.length?song.tags:['sem tags']).slice(0,3).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div></article>`).join('');
    dom.libraryList.querySelectorAll('.song-item').forEach(item=>{
      item.addEventListener('click',()=>openSong(item.dataset.id));
      item.addEventListener('dblclick',()=>{ const song=state.allSongs.find(s=>s.id===item.dataset.id); if(song){ state.setlist.push({...song}); renderSetlist(); } });
    });
  }
  function renderSavedPlaylists(){
    if(!dom.savedPlaylists) return;
    if(!state.savedSetlists.length){ dom.savedPlaylists.innerHTML='<div class="saved-playlist-card"><h4>🎶 Nenhum repertório salvo</h4><p>Salve um setlist para reutilizar.</p></div>'; return; }
    dom.savedPlaylists.innerHTML = state.savedSetlists.map((item,idx)=>{ const emoji=['🎤','🎸','🎶','🎹','🥁'][idx%5]; return `<article class="saved-playlist-card"><h4>${emoji} ${esc(item.name)}</h4><p>${(item.songs||[]).length} músicas</p><div class="setlist-inline"><button class="mini-btn load-playlist" data-id="${item.id}" type="button">Abrir</button><button class="mini-btn delete-playlist" data-id="${item.id}" type="button">Excluir</button></div></article>`; }).join('');
    dom.savedPlaylists.querySelectorAll('.load-playlist').forEach(btn=>btn.addEventListener('click',()=>loadSavedSetlist(btn.dataset.id)));
    dom.savedPlaylists.querySelectorAll('.delete-playlist').forEach(btn=>btn.addEventListener('click',()=>deleteSavedSetlist(btn.dataset.id)));
  }
  function updateSetlistStatus(){
    if(!dom.nowPlayingTitle || !dom.nextPlayingTitle) return;
    const currentIndex = state.setlist.findIndex(s=>s.id===state.selectedId);
    const resolved=currentIndex>=0?currentIndex:0;
    const current=state.setlist[resolved], next=state.setlist[resolved+1];
    dom.nowPlayingTitle.textContent=current?current.title:'Nenhuma música';
    dom.nextPlayingTitle.textContent=next?next.title:'Nenhuma música';
    if(dom.nextSongCard) dom.nextSongCard.textContent=next?`Próxima: ${next.title} — ${next.artist}`:'Nenhuma próxima música';
    const total=state.setlist.length, currentNum=total?Math.min(resolved+1,total):0;
    if(dom.setlistProgressFill) dom.setlistProgressFill.style.width=total?`${(currentNum/total)*100}%`:'0%';
    if(dom.setlistProgressLabel) dom.setlistProgressLabel.textContent=`${currentNum}/${total}`;
    if(dom.setlistSummary) dom.setlistSummary.textContent=`${total} músicas • ~${minutesEstimate()} min`;
    if(dom.setlistCount) dom.setlistCount.textContent=`${total} músicas`;
  }
  function renderSetlist(){
    if(!dom.setlistList) return;
    if(!state.setlist.length){ dom.setlistList.innerHTML='<div class="empty-state"><div class="empty-icon">♪</div><p>Monte seu repertório ao vivo.</p></div>'; updateSetlistStatus(); renderSavedPlaylists(); return; }
    dom.setlistList.innerHTML = state.setlist.map((song,index)=>`<article class="setlist-card ${song.id===state.selectedId?'active':''}" data-id="${song.id}" draggable="true" data-index="${index}"><h4>🎵 ${index+1} - ${esc(song.title)}</h4><p>Tom ${esc(song.key)} • BPM ${esc(song.bpm)} • ${esc(song.genre)}</p><div class="setlist-inline"><button class="mini-btn action-open" data-id="${song.id}" type="button">→ Abrir</button><button class="mini-btn action-fav" data-id="${song.id}" type="button">${isFavorite(song.id)?'★':'☆'}</button><button class="mini-btn action-edit" data-index="${index}" type="button">✏ Editar</button><button class="mini-btn action-remove" data-index="${index}" type="button">❌ Remover</button><button class="mini-btn" type="button">☰ Arrastar</button></div></article>`).join('');
    dom.setlistList.querySelectorAll('.action-open').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openSong(btn.dataset.id);}));
    dom.setlistList.querySelectorAll('.action-fav').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation(); const song=state.setlist.find(s=>s.id===btn.dataset.id); if(!song) return; if(isFavorite(song.id)) state.favorites=state.favorites.filter(x=>x.id!==song.id); else state.favorites.unshift({id:song.id,title:song.title}); writeFavorites(state.favorites); renderSetlist(); renderLibrary(); updateFavoriteButton(); }));
    dom.setlistList.querySelectorAll('.action-edit').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation(); const idx=Number(btn.dataset.index); const song=state.setlist[idx]; if(!song) return; const newTitle=prompt('Editar nome da música no setlist:', song.title); if(newTitle){ state.setlist[idx]={...song,title:newTitle.trim()}; renderSetlist(); } }));
    dom.setlistList.querySelectorAll('.action-remove').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation(); state.setlist.splice(Number(btn.dataset.index),1); renderSetlist(); }));
    dom.setlistList.querySelectorAll('.setlist-card').forEach(card=>{
      card.addEventListener('click',()=>openSong(card.dataset.id));
      card.addEventListener('dragstart',()=>{ state.dragIndex=Number(card.dataset.index); card.classList.add('dragging'); });
      card.addEventListener('dragend',()=>{ state.dragIndex=null; card.classList.remove('dragging'); });
      card.addEventListener('dragover',e=>e.preventDefault());
      card.addEventListener('drop',e=>{ e.preventDefault(); const from=state.dragIndex, to=Number(card.dataset.index); if(from===null||from===to) return; const item=state.setlist.splice(from,1)[0]; state.setlist.splice(to,0,item); renderSetlist(); });
    });
    updateSetlistStatus(); renderSavedPlaylists();
  }
  function renderCurrentSong(){
    const song=currentSong(); if(!song || !dom.viewerContent) return;
    if(song.pdf){ dom.viewerContent.classList.toggle('mirrored',state.mirrored); dom.viewerContent.innerHTML=`<iframe src="${song.pdf}" style="width:100%;height:72vh;border:none;border-radius:18px;background:#fff"></iframe>`; if(dom.metaKey) dom.metaKey.textContent=song.key||'—'; return; }
    const transposed=transposeText(song.lyrics||'Sem letra/cifra cadastrada.',state.transpose);
    dom.viewerContent.classList.toggle('mirrored',state.mirrored);
    dom.viewerContent.innerHTML=highlightLyrics(transposed);
    if(dom.metaKey) dom.metaKey.textContent=song.key&&song.key!=='—'?transposeRoot(song.key,state.transpose):'—';
  }
  function openSong(id){
    const song=state.allSongs.find(s=>s.id===id)||state.setlist.find(s=>s.id===id);
    if(!song) return;
    state.selectedId=id; state.transpose=0;
    if(dom.viewerTitle) dom.viewerTitle.textContent=song.title;
    if(dom.viewerSubtitle) dom.viewerSubtitle.textContent=`${song.artist}${song.notes?' • '+song.notes:''}`;
    if(dom.metaBpm) dom.metaBpm.textContent=song.bpm||'—';
    if(dom.metaCapo) dom.metaCapo.textContent=song.capo||'—';
    if(dom.metaSource) dom.metaSource.textContent=song.source||'—';
    renderCurrentSong(); renderLibrary(); renderSetlist(); updateFavoriteButton(); updateProgress(); window.scrollTo({top:0,behavior:'smooth'});
  }
  async function loadLibrary(){
    try{
      const online=await fetchOnlineLibrary(), local=getLocalLibrary();
      state.allSongs=[...online,...local];
      populateFilters(); renderLibrary(); renderSetlist();
      if(state.allSongs.length&&!state.selectedId) openSong(state.allSongs[0].id);
    }catch(e){
      if(dom.libraryCount) dom.libraryCount.textContent='erro';
      if(dom.libraryList) dom.libraryList.innerHTML=`<div class="empty-state"><div class="empty-icon">!</div><p>Não foi possível carregar a biblioteca.</p><p style="font-size:.9rem">${esc(e.message)}</p></div>`;
      console.error(e);
    }
  }
  function setViewerSize(size){ document.documentElement.style.setProperty('--size',`${size}px`); if(dom.fontRange) dom.fontRange.value=size; }
  function toggleScroll(){ if(state.scrollTimer){ clearInterval(state.scrollTimer); state.scrollTimer=null; if(dom.startScroll) dom.startScroll.textContent='Auto Scroll'; return; } state.scrollTimer=setInterval(()=>{ window.scrollBy({top:state.scrollSpeed,left:0,behavior:'smooth'}); updateProgress(); },90); if(dom.startScroll) dom.startScroll.textContent='Parar Scroll'; }
  function updateProgress(){ if(!dom.scrollProgress) return; const doc=document.documentElement; const max=Math.max(1,doc.scrollHeight-window.innerHeight); const pct=Math.min(100,Math.max(0,(window.scrollY/max)*100)); dom.scrollProgress.style.width=`${pct}%`; }
  function addCurrentToSetlist(){ const song=currentSong(); if(!song) return; state.setlist.push({...song}); renderSetlist(); }
  function goRelative(delta){ if(!state.setlist.length) return; const idx=state.setlist.findIndex(song=>song.id===state.selectedId); const nextIdx=idx===-1?0:Math.min(Math.max(idx+delta,0),state.setlist.length-1); openSong(state.setlist[nextIdx].id); }
  function jumpToTrack(){ const idx=Number(dom.jumpInput ? dom.jumpInput.value : 0)-1; if(idx>=0&&idx<state.setlist.length) openSong(state.setlist[idx].id); }
  function saveSetlist(){ const name=prompt('Nome do repertório:', `Setlist ${new Date().toLocaleDateString('pt-BR')}`); if(!name) return; state.savedSetlists.unshift({id:`setlist-${Date.now()}`,name,createdAt:new Date().toISOString(),songs:state.setlist}); writeSavedSetlists(state.savedSetlists); if(dom.setlistTitle) dom.setlistTitle.textContent=`Setlist atual • ${name}`; renderSavedPlaylists(); }
  function loadSavedSetlist(id){ const item=state.savedSetlists.find(x=>x.id===id); if(!item) return; state.setlist=(item.songs||[]).map(song=>({...song})); if(dom.setlistTitle) dom.setlistTitle.textContent=`Setlist atual • ${item.name}`; renderSetlist(); if(state.setlist.length) openSong(state.setlist[0].id); }
  function deleteSavedSetlist(id){ state.savedSetlists=state.savedSetlists.filter(x=>x.id!==id); writeSavedSetlists(state.savedSetlists); renderSavedPlaylists(); }
  function handlePdfUpload(event){ const file=event.target.files&&event.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=async()=>{ const items=readLocalPdfs(); items.unshift({title:file.name.replace(/\.pdf$/i,''),dataUrl:reader.result}); writeLocalPdfs(items); await loadLibrary(); }; reader.readAsDataURL(file); }
  function handleKeys(e){ if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return; if(e.key==='ArrowRight') goRelative(1); else if(e.key==='ArrowLeft') goRelative(-1); else if(e.key===' '){ e.preventDefault(); toggleScroll(); } }
  function bindSwipe(){ if(!dom.viewerCard) return; dom.viewerCard.addEventListener('touchstart',e=>{ state.touchStartX=e.changedTouches[0].clientX; },{passive:true}); dom.viewerCard.addEventListener('touchend',e=>{ const deltaX=e.changedTouches[0].clientX-state.touchStartX; if(Math.abs(deltaX)<50) return; if(deltaX<0) goRelative(1); else goRelative(-1); },{passive:true}); }

  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{ document.querySelectorAll('.tab').forEach(btn=>btn.classList.remove('active')); tab.classList.add('active'); state.filter=tab.dataset.filter; renderLibrary(); }));
  if(dom.searchInput) dom.searchInput.addEventListener('input',renderLibrary);
  if(dom.genreFilter) dom.genreFilter.addEventListener('change',renderLibrary);
  if(dom.classificationFilter) dom.classificationFilter.addEventListener('change',renderLibrary);
  if(dom.refreshLibrary) dom.refreshLibrary.addEventListener('click',loadLibrary);
  if(dom.pdfInput) dom.pdfInput.addEventListener('change',handlePdfUpload);
  if(dom.toggleStageMode) dom.toggleStageMode.addEventListener('click',()=>document.body.classList.toggle('stage-mode'));
  if(dom.increaseFont) dom.increaseFont.addEventListener('click',()=>setViewerSize(Math.min(48,Number(dom.fontRange ? dom.fontRange.value : 22)+1)));
  if(dom.decreaseFont) dom.decreaseFont.addEventListener('click',()=>setViewerSize(Math.max(14,Number(dom.fontRange ? dom.fontRange.value : 22)-1)));
  if(dom.fontRange) dom.fontRange.addEventListener('input',e=>setViewerSize(e.target.value));
  if(dom.startScroll) dom.startScroll.addEventListener('click',toggleScroll);
  if(dom.scrollSpeed) dom.scrollSpeed.addEventListener('input',e=>state.scrollSpeed=Number(e.target.value));
  if(dom.addToSetlist) dom.addToSetlist.addEventListener('click',addCurrentToSetlist);
  if(dom.nextSong) dom.nextSong.addEventListener('click',()=>goRelative(1));
  if(dom.prevSong) dom.prevSong.addEventListener('click',()=>goRelative(-1));
  if(dom.jumpButton) dom.jumpButton.addEventListener('click',jumpToTrack);
  if(dom.jumpInput) dom.jumpInput.addEventListener('keydown',e=>{ if(e.key==='Enter') jumpToTrack(); });
  if(dom.saveSetlist) dom.saveSetlist.addEventListener('click',saveSetlist);
  if(dom.clearSetlist) dom.clearSetlist.addEventListener('click',()=>{ state.setlist=[]; renderSetlist(); });
  if(dom.copyText) dom.copyText.addEventListener('click',async()=>{ const song=currentSong(); if(!song||song.pdf) return; try{ await navigator.clipboard.writeText(transposeText(song.lyrics||'',state.transpose)); dom.copyText.textContent='Copiado'; setTimeout(()=>dom.copyText.textContent='Copiar',1200); }catch(e){} });
  if(dom.toggleFavorite) dom.toggleFavorite.addEventListener('click',()=>{ const song=currentSong(); if(!song) return; if(isFavorite(song.id)) state.favorites=state.favorites.filter(x=>x.id!==song.id); else state.favorites.unshift({id:song.id,title:song.title}); writeFavorites(state.favorites); renderLibrary(); renderSetlist(); updateFavoriteButton(); });
  if(dom.transposeUp) dom.transposeUp.addEventListener('click',()=>{ state.transpose+=1; renderCurrentSong(); });
  if(dom.transposeDown) dom.transposeDown.addEventListener('click',()=>{ state.transpose-=1; renderCurrentSong(); });
  if(dom.toggleMirror) dom.toggleMirror.addEventListener('click',()=>{ state.mirrored=!state.mirrored; renderCurrentSong(); });
  window.addEventListener('keydown',handleKeys);
  window.addEventListener('scroll',updateProgress,{passive:true});

  unregisterOldCaches();
  bindSwipe();
  setViewerSize(22);
  loadLibrary();
  updateProgress();
})();
