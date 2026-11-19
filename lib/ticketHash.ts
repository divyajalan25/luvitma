export function generateCompactTicketHash(regNo: string): string {
  const cleanReg = String(regNo || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i++) {
      suffix += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return cleanReg ? `${cleanReg}-${suffix}` : `PASS-${suffix}`;
}
