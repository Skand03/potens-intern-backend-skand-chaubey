import crypto from 'crypto';

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + (value as unknown[]).map(canonicalize).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const pairs = Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

export function computeHash(
  previousHash: string,
  actor: string,
  action: string,
  payload: unknown,
  eventTime: string
): string {
  const input = [previousHash, actor, action, canonicalize(payload), eventTime].join('|');
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}