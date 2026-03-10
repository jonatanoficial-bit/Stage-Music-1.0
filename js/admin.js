
(function () {
  const f = {
    title: document.getElementById('title'),
    artist: document.getElementById('artist'),
    key: document.getElementById('key'),
    bpm: document.getElementById('bpm'),
    capo: document.getElementById('capo'),
    tags: document.getElementById('tags'),
    notes: document.getElementById('notes'),
    lyrics: document.getElementById('lyrics'),
    adminList: document.getElementById('adminList'),
    adminCount: document.getElementById('adminCount'),
    jsonFileInput: document.getElementById('jsonFileInput')
  };

  const state = { musics: readDraftLibrary() };

  function updateCount() {
    if (f.adminCount) f.adminCount.textContent = `${state.musics.length} músicas`;
  }

  function resetForm() {
    [f.title, f.artist, f.key, f.bpm, f.capo, f.tags, f.notes, f.lyrics].forEach(el => {
      if (el) el.value = '';
    });
  }

  function renderAdminList() {
    updateCount();
    if (!f.adminList) return;
    if (!state.musics.length) {
      f.adminList.innerHTML = '<div class="empty-state"><div class="empty-icon">♫</div><p>Adicione músicas para montar seu manifesto público.</p></div>';
      return;
    }

    f.adminList.innerHTML = state.musics.map((song, index) => `
      <article class="song-item">
        <h3>${song.title || 'Sem título'}</h3>
        <p>${song.artist || 'Artista não informado'} • Tom ${song.key || '—'} • ${song.bpm || '—'} BPM</p>
        <div class="song-tags">
          ${(Array.isArray(song.tags) ? song.tags : String(song.tags || '').split(',').map(v => v.trim()).filter(Boolean)).slice(0, 5).map(tag => `<span class="tag">${tag}</span>`).join('')}
          <button class="mini-btn delete-btn" data-index="${index}" type="button">Excluir</button>
        </div>
      </article>
    `).join('');

    f.adminList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.musics.splice(Number(btn.dataset.index), 1);
        writeDraftLibrary(state.musics);
        renderAdminList();
      });
    });
  }

  function getFormSong() {
    return {
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `song-${Date.now()}`,
      title: f.title ? f.title.value.trim() : '',
      artist: f.artist ? f.artist.value.trim() : '',
      key: f.key ? f.key.value.trim() : '',
      bpm: f.bpm ? f.bpm.value.trim() : '',
      capo: f.capo ? f.capo.value.trim() : '',
      tags: (f.tags ? f.tags.value : '').split(',').map(v => v.trim()).filter(Boolean),
      notes: f.notes ? f.notes.value.trim() : '',
      lyrics: f.lyrics ? f.lyrics.value.trim() : ''
    };
  }

  const addBtn = document.getElementById('addMusic');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const song = getFormSong();
      if (!song.title || !song.lyrics) {
        alert('Preencha pelo menos título e cifra/letra.');
        return;
      }
      state.musics.unshift(song);
      writeDraftLibrary(state.musics);
      renderAdminList();
      resetForm();
    });
  }

  const clearBtn = document.getElementById('clearForm');
  if (clearBtn) clearBtn.addEventListener('click', resetForm);

  const exportBtn = document.getElementById('exportJson');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const payload = { version: '1.0.0', updatedAt: new Date().toISOString(), musics: state.musics };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manifest.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const importBtn = document.getElementById('importJson');
  if (importBtn && f.jsonFileInput) {
    importBtn.addEventListener('click', () => f.jsonFileInput.click());
    f.jsonFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const payload = JSON.parse(text);
      state.musics = Array.isArray(payload.musics) ? payload.musics : [];
      writeDraftLibrary(state.musics);
      renderAdminList();
    });
  }

  renderAdminList();
})();
