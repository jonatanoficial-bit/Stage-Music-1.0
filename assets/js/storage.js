const APP_PREFIX = 'palcoPro';
const DB_NAME = 'palcoProAssets';
const DB_VERSION = 1;
const ASSET_STORE = 'pdfAssets';

const KEYS = {
  activePacks: `${APP_PREFIX}.activePacks.v1`,
  localPacks: `${APP_PREFIX}.localPacks.v1`,
  setlist: `${APP_PREFIX}.setlist.v1`,
  ui: `${APP_PREFIX}.ui.v1`,
  adminPassword: `${APP_PREFIX}.adminPassword.v1`,
  adminSession: `${APP_PREFIX}.adminSession.v1`
};

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Falha ao ler ${key}`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function remove(key) {
  localStorage.removeItem(key);
}

export const localStore = {
  getActivePacks() {
    return readJSON(KEYS.activePacks, {});
  },
  setActivePacks(value) {
    writeJSON(KEYS.activePacks, value);
  },
  getLocalPacks() {
    return readJSON(KEYS.localPacks, []);
  },
  setLocalPacks(value) {
    writeJSON(KEYS.localPacks, value);
  },
  getSetlist() {
    return readJSON(KEYS.setlist, { title: 'Meu repertório', songIds: [], currentSongId: null, updatedAt: null });
  },
  setSetlist(value) {
    writeJSON(KEYS.setlist, value);
  },
  getUI() {
    return readJSON(KEYS.ui, { fontScale: 1, transpose: 0, filter: 'all', search: '', scrollSpeed: 1, lastRoute: 'biblioteca' });
  },
  setUI(value) {
    writeJSON(KEYS.ui, value);
  },
  getAdminPassword() {
    return localStorage.getItem(KEYS.adminPassword) || 'palco123';
  },
  setAdminPassword(value) {
    localStorage.setItem(KEYS.adminPassword, value);
  },
  isAdminLoggedIn() {
    return localStorage.getItem(KEYS.adminSession) === '1';
  },
  setAdminSession(value) {
    localStorage.setItem(KEYS.adminSession, value ? '1' : '0');
  },
  clearLocalData() {
    remove(KEYS.localPacks);
    remove(KEYS.setlist);
    remove(KEYS.ui);
    remove(KEYS.activePacks);
    localStorage.removeItem(KEYS.adminSession);
  }
};

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function withStore(mode, callback) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, mode);
    const store = transaction.objectStore(ASSET_STORE);

    let result;
    try {
      result = callback(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function savePdfAsset(file) {
  if (!(file instanceof File)) {
    throw new Error('Arquivo inválido para upload de PDF.');
  }

  const id = `pdf-${crypto.randomUUID()}`;
  const payload = {
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/pdf',
    updatedAt: new Date().toISOString(),
    file
  };

  await withStore('readwrite', (store) => store.put(payload));
  return { id, name: file.name, size: file.size, type: payload.type };
}

export async function saveInlinePdfAsset({ fileName, dataUrl }) {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName || 'partitura.pdf', { type: 'application/pdf' });
  return savePdfAsset(file);
}

export async function getPdfAsset(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ASSET_STORE, 'readonly');
    const store = transaction.objectStore(ASSET_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePdfAsset(id) {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearPdfAssets() {
  await withStore('readwrite', (store) => store.clear());
}

export async function exportPdfAsset(id) {
  const asset = await getPdfAsset(id);
  if (!asset?.file) return null;
  return blobToDataUrl(asset.file);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = /data:(.*?);base64/.exec(meta || '');
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(content || '');
  const array = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    array[index] = binary.charCodeAt(index);
  }

  return new Blob([array], { type: mime });
}

export function downloadJSON(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadText(fileName, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}
