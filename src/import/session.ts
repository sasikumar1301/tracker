import type { ParsedImportRow } from './parser';

export interface ImportNotice {
  imageName: string;
  message: string;
}

export interface ImportSession {
  id: string;
  imageUris: string[];
  rows: ParsedImportRow[];
  notices: ImportNotice[];
}

let counter = 0;
let activeSession: ImportSession | null = null;

export function createImportSession(
  values: Omit<ImportSession, 'id'>,
): ImportSession {
  counter += 1;
  activeSession = { ...values, id: String(counter) };
  return activeSession;
}

export function getImportSession(id: string): ImportSession | null {
  return activeSession?.id === id ? activeSession : null;
}

export function clearImportSession(id: string): string[] {
  if (activeSession?.id !== id) return [];
  const uris = activeSession.imageUris;
  activeSession = null;
  return uris;
}
