function parseOrigin(entry: string): string {
  if (/[*?#]/.test(entry)) throw new Error('invalid origin');
  const url = new URL(entry);
  const httpOrigin = url.protocol === 'http:' || url.protocol === 'https:';
  if (!httpOrigin || url.username || url.password || url.pathname !== '/') {
    throw new Error('invalid origin');
  }
  return url.origin;
}

export function parseAllowedOrigins(raw: string): string[] {
  const origins = raw.split(',').map((entry) => parseOrigin(entry.trim()));
  return [...new Set(origins)];
}
