import { prisma } from '../db/client';
import { computeHash } from './hasher';

export interface VerifyResult {
  status: 'pass' | 'fail';
  broken_id?: number;
  reason?: 'previous_hash_mismatch' | 'hash_mismatch';
  checked?: number;
}

export async function verifyChain(): Promise<VerifyResult> {
  const entries = await prisma.logEntry.findMany({ orderBy: { id: 'asc' } });

  let expectedPrev = '0';

  for (const entry of entries) {
    if (entry.previousHash !== expectedPrev) {
      return {
        status: 'fail',
        broken_id: entry.id,
        reason: 'previous_hash_mismatch',
      };
    }

    const recomputed = computeHash(
      entry.previousHash,
      entry.actor,
      entry.action,
      entry.payload,
      entry.eventTime
    );

    if (entry.currentHash !== recomputed) {
      return {
        status: 'fail',
        broken_id: entry.id,
        reason: 'hash_mismatch',
      };
    }

    expectedPrev = entry.currentHash;
  }

  return { status: 'pass', checked: entries.length };
}

export async function verifyEntry(id: number): Promise<{
  selfHashValid: boolean;
  linkValid: boolean;
  overall: 'valid' | 'invalid';
}> {
  const entry = await prisma.logEntry.findUnique({ where: { id } });
  if (!entry) {
    return { selfHashValid: false, linkValid: false, overall: 'invalid' };
  }

  const recomputed = computeHash(
    entry.previousHash,
    entry.actor,
    entry.action,
    entry.payload,
    entry.eventTime
  );
  const selfHashValid = entry.currentHash === recomputed;

  let linkValid: boolean;
  if (entry.id === 1) {
    linkValid = entry.previousHash === '0';
  } else {
    const prev = await prisma.logEntry.findUnique({ where: { id: entry.id - 1 } });
    linkValid = prev !== null && entry.previousHash === prev.currentHash;
  }

  return {
    selfHashValid,
    linkValid,
    overall: selfHashValid && linkValid ? 'valid' : 'invalid',
  };
}