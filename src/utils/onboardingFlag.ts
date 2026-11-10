import { File, Paths } from 'expo-file-system';

/**
 * Whether a brand-new account still owes the first-car step — on disk, so a
 * cold start mid-onboarding comes back to it. A file's presence is the flag;
 * same storage the nav state uses (navigation/navPersistence).
 */
const FILENAME = 'onboarding.pending';

const flagFile = () => new File(Paths.document, FILENAME);

export function readOnboardingFlag(): boolean {
  try { return flagFile().exists; } catch { return false; }
}

export function writeOnboardingFlag(on: boolean): void {
  try {
    const file = flagFile();
    if (on) { if (!file.exists) file.create({ intermediates: true, overwrite: true }); file.write('1'); }
    else if (file.exists) file.delete();
  } catch {}
}
