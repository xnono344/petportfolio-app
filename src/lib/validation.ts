export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePetName(name: string): string | null {
  if (!name.trim()) return 'Give your pet a name.';
  if (name.trim().length > 40) return 'Keep the name under 40 characters.';
  return null;
}

export function validateJournalNote(note: string): string | null {
  if (note.length > 280) return `Notes can be up to 280 characters (${note.length}/280).`;
  return null;
}

export function clampNote(note: string): string {
  return note.slice(0, 280);
}
