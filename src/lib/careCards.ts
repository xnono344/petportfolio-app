export const CARE_CARD_BASE_URL_FALLBACK = 'https://petportfolio.app';

function baseUrl(): string {
  const env = (process.env.EXPO_PUBLIC_CARE_CARD_BASE_URL ?? '').trim();
  return (env || CARE_CARD_BASE_URL_FALLBACK).replace(/\/$/, '');
}

export const CARE_FIELD_OPTIONS = [
  { key: 'feeding', label: 'Feeding amount & schedule' },
  { key: 'care_notes', label: 'Care notes' },
  { key: 'last_walk', label: 'Last walk' },
  { key: 'medications', label: 'Medications' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'conditions', label: 'Known conditions' },
  { key: 'vet_phone', label: 'Vet phone' },
  { key: 'emergency_contact', label: 'Emergency contact' },
] as const;

export type CareFieldKey = (typeof CARE_FIELD_OPTIONS)[number]['key'];

export function careCardUrl(token: string): string {
  if (!/^[a-z0-9_-]+$/i.test(token)) {
    throw new Error(`careCardUrl: invalid token, expected alphanumeric only`);
  }
  return `${baseUrl()}/c/${token}`;
}
