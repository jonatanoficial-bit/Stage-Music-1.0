import { localStore, exportPdfAsset, saveInlinePdfAsset, deletePdfAsset } from './storage.js';
import {
  createSongSearchIndex,
  dedupeSongs,
  formatPackSource,
  generateId,
  isValidPack,
  isValidSong,
  normalizeArray,
  sortSongs,
  slugify
} from './utils.js';

const DEFAULT_LOCAL_PACK = {
  id: 'local-admin',
  name: 'Conteúdo local do Admin',
  version: '1.0.0',
  description: 'Pack editável salvo no navegador para músicas criadas ou importadas localmente.',
  themeAccent: '#7c5cff',
  required: false,
  songs: []
};

async function fetchJSON(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path}`);
  }
  return response.json();
}

function normalizeSong(song, pack) {
  return {
    id: song.id,
    title: song.title || 'Sem título',
    artist: song.artist || 'Sem artista',
    key: song.key || '',
    bpm: Number(song.bpm) || 0,
    type: song.type === 'pdf' ? 'pdf' : 'text',
    format: song.format || (song.type === 'pdf' ? 'partitura' : 'cifra'),
    tags: normalizeArray(song.tags),
    notes: song.notes || '',
    shortcuts: song.shortcuts || {},
    content: song.content || '',
    pdfUrl: song.pdfUrl || '',
    assetRef: song.assetRef || null,
    packId: pack.id,
    packName: pack.name,
    packVersion: pack.version,
    themeAccent: pack.themeAccent || '#7c5cff',
    isLocal: Boolean(pack.isLocal),
    sourceLabel: formatPackSource(pack),
    searchIndex: createSongSearchIndex({
      ...song,
      packName: pack.name,
      tags: normalizeArray(song.tags)
    })
  };
}

function normalizePack(pack, isLocal = false) {
  return {
    id: pack.id,
    name: pack.name,
    version: pack.version || '1.0.0',
    description: pack.description || 'Pack sem descrição.',
    author: pack.author || 'Palco Pro',
    themeAccent: pack.themeAccent || '#7c5cff',
    required: Boolean(pack.required),
    isLocal,
    songs: sortSongs((pack.songs || []).filter(isValidSong).map((song) => normalizeSong(song, { ...pack, isLocal })))
  };
}

function ensureDefaultLocalPack(packs) {
  if (packs.some((pack) => pack.id === DEFAULT_LOCAL_PACK.id)) return packs;
  return [...packs, { ...DEFAULT_LOCAL_PACK }];
}

export class ContentManager {
  constructor() {
    this.registry = null;
    this.builtInPacks = [];
    this.localPacks = [];
  }

  async load() {
    this.registry = await fetchJSON('./content/registry.json');
    const builtInPacks = await Promise.all(
      (this.registry.packs || []).map(async (entry) => {
        const manifest = await fetchJSON(entry.path);
        return normalizePack({ ...manifest, required: entry.required ?? manifest.required }, false);
      })
    );

    this.builtInPacks = builtInPacks;
    this.localPacks = ensureDefaultLocalPack(localStore.getLocalPacks()).map((pack) => normalizePack(pack, true));
    localStore.setLocalPacks(this.serializeLocalPacks(this.localPacks));
    return this.getSnapshot();
  }

  getSnapshot() {
    const packs = [...this.builtInPacks, ...this.localPacks];
    const activeMap = localStore.getActivePacks();

    const enrichedPacks = packs.map((pack) => ({
      ...pack,
      active: pack.required ? true : activeMap[pack.id] ?? pack.id === DEFAULT_LOCAL_PACK.id,
      songCount: pack.songs.length
    }));

    const activeSongs = dedupeSongs(
      enrichedPacks
        .filter((pack) => pack.active)
        .flatMap((pack) => pack.songs)
    );

    return {
      packs: enrichedPacks,
      songs: sortSongs(activeSongs),
      builtInPacks: this.builtInPacks,
      localPacks: this.localPacks
    };
  }

  serializeLocalPacks(packs = this.localPacks) {
    return packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      version: pack.version,
      description: pack.description,
      author: pack.author,
      themeAccent: pack.themeAccent,
      required: false,
      songs: pack.songs.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        key: song.key,
        bpm: song.bpm,
        type: song.type,
        format: song.format,
        tags: song.tags,
        notes: song.notes,
        shortcuts: song.shortcuts,
        content: song.content,
        pdfUrl: song.pdfUrl,
        assetRef: song.assetRef
      }))
    }));
  }

  persistLocalPacks() {
    localStore.setLocalPacks(this.serializeLocalPacks(this.localPacks));
  }

  togglePack(packId, value) {
    const activeMap = localStore.getActivePacks();
    activeMap[packId] = value;
    localStore.setActivePacks(activeMap);
    return this.getSnapshot();
  }

  upsertPack(packInput) {
    const normalizedId = slugify(packInput.id || packInput.name || 'pack-local');
    const incoming = {
      id: normalizedId,
      name: packInput.name || 'Pack local',
      version: packInput.version || '1.0.0',
      description: packInput.description || 'Pack local criado pelo administrador.',
      author: packInput.author || 'Admin local',
      themeAccent: packInput.themeAccent || '#7c5cff',
      required: false,
      songs: Array.isArray(packInput.songs) ? packInput.songs : []
    };

    const existingIndex = this.localPacks.findIndex((pack) => pack.id === normalizedId);
    const normalizedPack = normalizePack(existingPackSongs(existingIndex, incoming, this.localPacks), true);

    if (existingIndex >= 0) {
      this.localPacks.splice(existingIndex, 1, normalizedPack);
    } else {
      this.localPacks.push(normalizedPack);
      const activeMap = localStore.getActivePacks();
      activeMap[normalizedPack.id] = true;
      localStore.setActivePacks(activeMap);
    }

    this.persistLocalPacks();
    return this.getSnapshot();
  }

  getPack(packId) {
    return [...this.builtInPacks, ...this.localPacks].find((pack) => pack.id === packId) || null;
  }

  getSong(songId) {
    return this.getSnapshot().songs.find((song) => song.id === songId) || null;
  }

  async upsertSong(songInput) {
    const targetPackId = songInput.packId || DEFAULT_LOCAL_PACK.id;
    let targetPack = this.localPacks.find((pack) => pack.id === targetPackId);

    if (!targetPack) {
      this.upsertPack({ id: targetPackId, name: songInput.packName || targetPackId, songs: [] });
      targetPack = this.localPacks.find((pack) => pack.id === targetPackId);
    }

    const songId = songInput.id || generateId('song');
    const nextSong = {
      id: songId,
      title: songInput.title || 'Nova música',
      artist: songInput.artist || 'Sem artista',
      key: songInput.key || '',
      bpm: Number(songInput.bpm) || 0,
      type: songInput.type === 'pdf' ? 'pdf' : 'text',
      format: songInput.format || (songInput.type === 'pdf' ? 'partitura' : 'cifra'),
      tags: normalizeArray(songInput.tags),
      notes: songInput.notes || '',
      shortcuts: songInput.shortcuts || {},
      content: songInput.content || '',
      pdfUrl: songInput.pdfUrl || '',
      assetRef: songInput.assetRef || null
    };

    const oldPackIndex = this.localPacks.findIndex((pack) => pack.songs.some((song) => song.id === songId));
    const oldPack = oldPackIndex >= 0 ? this.localPacks[oldPackIndex] : null;
    const oldSong = oldPack?.songs.find((song) => song.id === songId) || null;

    if (oldPack) {
      oldPack.songs = oldPack.songs.filter((song) => song.id !== songId);
    }

    if (oldSong?.assetRef?.id && oldSong.assetRef.id !== nextSong.assetRef?.id) {
      await deletePdfAsset(oldSong.assetRef.id);
    }

    targetPack.songs = [...targetPack.songs.filter((song) => song.id !== songId), normalizeSong(nextSong, { ...targetPack, isLocal: true })];
    targetPack.songs = sortSongs(targetPack.songs);

    this.persistLocalPacks();
    return this.getSnapshot();
  }

  async deleteSong(songId) {
    for (const pack of this.localPacks) {
      const target = pack.songs.find((song) => song.id === songId);
      if (!target) continue;
      if (target.assetRef?.id) {
        await deletePdfAsset(target.assetRef.id);
      }
      pack.songs = pack.songs.filter((song) => song.id !== songId);
      this.persistLocalPacks();
      return true;
    }
    return false;
  }

  async deletePack(packId) {
    const index = this.localPacks.findIndex((pack) => pack.id === packId);
    if (index < 0 || packId === DEFAULT_LOCAL_PACK.id) return false;
    const [pack] = this.localPacks.splice(index, 1);
    await Promise.all(pack.songs.map((song) => (song.assetRef?.id ? deletePdfAsset(song.assetRef.id) : Promise.resolve())));
    this.persistLocalPacks();
    const activeMap = localStore.getActivePacks();
    delete activeMap[packId];
    localStore.setActivePacks(activeMap);
    return true;
  }

  async installPack(packData) {
    if (!isValidPack(packData)) {
      throw new Error('Manifesto de pack inválido.');
    }

    const clonedPack = structuredClone(packData);
    clonedPack.id = slugify(clonedPack.id || clonedPack.name || 'pack-importado');
    clonedPack.songs = clonedPack.songs || [];

    for (const song of clonedPack.songs) {
      if (song.type === 'pdf' && song.inlinePdfData) {
        const assetRef = await saveInlinePdfAsset({
          dataUrl: song.inlinePdfData,
          fileName: song.fileName || `${song.title || 'partitura'}.pdf`
        });
        song.assetRef = assetRef;
        delete song.inlinePdfData;
        delete song.fileName;
      }
    }

    const nextPack = normalizePack(
      {
        id: clonedPack.id,
        name: clonedPack.name,
        version: clonedPack.version,
        description: clonedPack.description,
        author: clonedPack.author || 'Importado',
        themeAccent: clonedPack.themeAccent,
        required: false,
        songs: clonedPack.songs
      },
      true
    );

    const existingIndex = this.localPacks.findIndex((pack) => pack.id === nextPack.id);
    if (existingIndex >= 0) {
      this.localPacks.splice(existingIndex, 1, nextPack);
    } else {
      this.localPacks.push(nextPack);
    }

    this.persistLocalPacks();
    const activeMap = localStore.getActivePacks();
    activeMap[nextPack.id] = true;
    localStore.setActivePacks(activeMap);
    return this.getSnapshot();
  }

  async exportPack(packId) {
    const pack = this.localPacks.find((item) => item.id === packId);
    if (!pack) throw new Error('Pack local não encontrado.');

    const exportedSongs = [];
    for (const song of pack.songs) {
      const baseSong = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        key: song.key,
        bpm: song.bpm,
        type: song.type,
        format: song.format,
        tags: song.tags,
        notes: song.notes,
        shortcuts: song.shortcuts,
        content: song.content,
        pdfUrl: song.pdfUrl
      };

      if (song.assetRef?.id) {
        baseSong.inlinePdfData = await exportPdfAsset(song.assetRef.id);
        baseSong.fileName = song.assetRef.name || `${song.title}.pdf`;
      }

      exportedSongs.push(baseSong);
    }

    return {
      id: pack.id,
      name: pack.name,
      version: pack.version,
      author: pack.author,
      description: pack.description,
      themeAccent: pack.themeAccent,
      songs: exportedSongs
    };
  }

  async exportBackup() {
    const setlist = localStore.getSetlist();
    const ui = localStore.getUI();
    const activePacks = localStore.getActivePacks();
    const packs = [];

    for (const pack of this.localPacks) {
      packs.push(await this.exportPack(pack.id));
    }

    return {
      schema: 'palco-pro-backup/v1',
      exportedAt: new Date().toISOString(),
      setlist,
      ui,
      activePacks,
      packs
    };
  }

  async importBackup(backup) {
    if (!backup?.schema?.startsWith('palco-pro-backup/')) {
      throw new Error('Arquivo de backup incompatível.');
    }

    const incomingPacks = Array.isArray(backup.packs) ? backup.packs : [];
    const replaced = [];
    for (const pack of incomingPacks) {
      await this.installPack(pack);
      replaced.push(pack.id);
    }

    if (backup.setlist) localStore.setSetlist(backup.setlist);
    if (backup.ui) localStore.setUI(backup.ui);
    if (backup.activePacks) localStore.setActivePacks(backup.activePacks);
    return { replaced };
  }
}

function existingPackSongs(existingIndex, incoming, packs) {
  if (existingIndex < 0) return incoming;
  const existingPack = packs[existingIndex];
  return {
    ...existingPack,
    ...incoming,
    songs: incoming.songs?.length ? incoming.songs : existingPack.songs
  };
}
