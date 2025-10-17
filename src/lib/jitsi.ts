// Lightweight Jitsi utilities
// - Room name: `${prefix}-${uuid}` (lowercase)
// - Link: https://meet.jit.si/<room>

function genUUID(): string {
  // Prefer Web Crypto when available
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      // @ts-ignore - crypto may be ambient in Edge runtimes
      return crypto.randomUUID();
    }
  } catch {}
  // Fallback: RFC4122 v4-ish using Math.random (good enough for room slugs)
  const s: string[] = [];
  const hex = '0123456789abcdef';
  for (let i = 0; i < 36; i++) s[i] = hex.substr(Math.floor(Math.random() * 16), 1);
  s[14] = '4';
  // @ts-ignore
  s[19] = hex.substr((parseInt(s[19], 16) & 0x3) | 0x8, 1);
  s[8] = s[13] = s[18] = s[23] = '-';
  return s.join('');
}

export function createJitsiRoomName(prefix = 'tutor'): string {
  const uuid = genUUID().toLowerCase();
  return `${prefix}-${uuid}`;
}

export function jitsiLink(roomName: string): string {
  const slug = String(roomName || '').trim();
  return `https://meet.jit.si/${encodeURIComponent(slug)}`;
}
