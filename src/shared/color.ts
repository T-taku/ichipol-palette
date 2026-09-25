export function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

export function darken(hex: string, ratio: number): string {
  const safe = normalizeHex(hex) ?? '#888888';
  const channels = [1, 3, 5].map((start) => parseInt(safe.slice(start, start + 2), 16));
  const next = channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel * (1 - ratio)))));
  return `#${next.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function textOn(hex: string): string {
  const safe = normalizeHex(hex) ?? '#ffffff';
  const channels = [1, 3, 5].map((start) => parseInt(safe.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.45 ? '#1c2430' : '#ffffff';
}
