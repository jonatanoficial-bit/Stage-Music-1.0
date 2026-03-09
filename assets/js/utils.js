const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11
};

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
const CHORD_TOKEN = /^([A-G](?:#|b)?)([^/\s]*?)(?:\/([A-G](?:#|b)?))?$/;

export const SHORTCUTS = [
  { key: 'Espaço ou ]', action: 'Próxima música' },
  { key: 'Backspace ou [', action: 'Música anterior' },
  { key: '+ / -', action: 'Aumenta ou reduz fonte' },
  { key: 'T / G', action: 'Sobe ou desce o tom' },
  { key: 'S', action: 'Ativa/desativa auto-scroll' },
  { key: 'F', action: 'Alterna tela cheia' }
];

export function slugify(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


export function escapeHTML(value = '') {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatSongType(type) {
  return type === 'pdf' ? 'PDF' : 'Texto';
}

export function formatPackSource(pack) {
  return pack.isLocal ? 'Local' : 'Embutido';
}

export function excerpt(text = '', maxLength = 180) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trim()}…`;
}

export function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function sortSongs(songs) {
  return [...songs].sort((first, second) => first.title.localeCompare(second.title, 'pt-BR'));
}

export function createSongSearchIndex(song) {
  return [song.title, song.artist, song.key, song.packName, ...(song.tags || [])]
    .join(' ')
    .toLowerCase();
}

export function transposeKeyLabel(key, semitones) {
  if (!key) return key;
  const minor = key.endsWith('m');
  const base = minor ? key.slice(0, -1) : key;
  const index = NOTE_INDEX[base];
  if (index == null) return key;
  const useFlats = FLAT_KEYS.has(key);
  const nextIndex = (index + semitones + 120) % 12;
  const nextBase = (useFlats ? FLAT_SCALE : SHARP_SCALE)[nextIndex];
  return minor ? `${nextBase}m` : nextBase;
}

function transposeNote(note, semitones, useFlats) {
  const index = NOTE_INDEX[note];
  if (index == null) return note;
  const nextIndex = (index + semitones + 120) % 12;
  return (useFlats ? FLAT_SCALE : SHARP_SCALE)[nextIndex];
}

function transposeChordToken(token, semitones, baseKey) {
  const match = CHORD_TOKEN.exec(token);
  if (!match) return token;

  const [, root, quality = '', bass] = match;
  const useFlats = FLAT_KEYS.has(baseKey) || root.includes('b');
  const nextRoot = transposeNote(root, semitones, useFlats);
  const nextBass = bass ? transposeNote(bass, semitones, useFlats) : '';

  return `${nextRoot}${quality}${nextBass ? `/${nextBass}` : ''}`;
}

function looksLikeChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const chordMatches = tokens.filter((token) => CHORD_TOKEN.test(token)).length;
  return chordMatches / tokens.length >= 0.6;
}

export function transposeSongContent(content = '', semitones = 0, key = 'C') {
  if (!content || !semitones) return content;

  return content
    .split('\n')
    .map((line) => {
      if (looksLikeChordLine(line)) {
        return line
          .split(/(\s+)/)
          .map((segment) => (CHORD_TOKEN.test(segment) ? transposeChordToken(segment, semitones, key) : segment))
          .join('');
      }

      return line.replace(/\[([A-G](?:#|b)?[^\]]*?)\]/g, (fullMatch, chordBody) => {
        const safeChord = transposeChordToken(chordBody, semitones, key);
        return `[${safeChord}]`;
      });
    })
    .join('\n');
}

export function generateId(prefix = 'item') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function packLabel(version) {
  return version ? `v${version}` : 'v1';
}

export function dedupeSongs(songs) {
  const seen = new Set();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

export function isValidPack(pack) {
  return Boolean(pack?.id && pack?.name && Array.isArray(pack?.songs));
}

export function isValidSong(song) {
  return Boolean(song?.id && song?.title && song?.type);
}

export function getSongDisplayKey(song, transpose = 0) {
  return song?.key ? transposeKeyLabel(song.key, transpose) : 'Sem tom';
}
