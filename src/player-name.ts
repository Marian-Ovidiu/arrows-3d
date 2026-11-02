/** Explicit nicknames win; Google defaults never expose a family name or email. */
export function playerName(metadata: Record<string, unknown> = {}): string {
  const text = (key: string) => typeof metadata[key] === 'string' ? metadata[key].trim().replace(/\s+/gu, ' ').slice(0,80) : '';
  return text('display_name') || text('given_name') || (text('full_name') || text('name')).split(' ')[0];
}
