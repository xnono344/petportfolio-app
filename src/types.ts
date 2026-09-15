export type Species =
  | 'dog'
  | 'cat'
  | 'bird'
  | 'fish'
  | 'rabbit'
  | 'hamster'
  | 'turtle'
  | 'lizard'
  | 'snake'
  | 'horse'
  | 'hedgehog'
  | 'other';

export const SPECIES: { id: Species; label: string; emoji: string }[] = [
  { id: 'dog', label: 'Dog', emoji: '🐶' },
  { id: 'cat', label: 'Cat', emoji: '🐱' },
  { id: 'bird', label: 'Bird', emoji: '🐦' },
  { id: 'fish', label: 'Fish', emoji: '🐟' },
  { id: 'rabbit', label: 'Rabbit', emoji: '🐰' },
  { id: 'hamster', label: 'Hamster', emoji: '🐹' },
  { id: 'turtle', label: 'Turtle', emoji: '🐢' },
  { id: 'lizard', label: 'Lizard', emoji: '🦎' },
  { id: 'snake', label: 'Snake', emoji: '🐍' },
  { id: 'horse', label: 'Horse', emoji: '🐴' },
  { id: 'hedgehog', label: 'Hedgehog', emoji: '🦔' },
  { id: 'other', label: 'Other', emoji: '🐾' },
];

export function speciesInfo(species: string | null | undefined): { label: string; emoji: string } {
  const hit = SPECIES.find((s) => s.id === species);
  return hit ?? { label: 'Pet', emoji: '🐾' };
}

export type PetRole = 'owner' | 'viewer' | 'carer';
export type HealthKind = 'vet_visit' | 'vaccination' | 'medication' | 'emergency';
export type CareActionKind = 'fed' | 'walked' | 'meds';

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: Species;
  breed: string;
  photo_url: string | null;
  birth_date: string | null; // ISO date
  weight_kg: number | null;
  allergies: string;
  conditions: string;
  vet_name: string;
  vet_phone: string;
  emergency_contact: string;
  feeding_notes: string;
  care_notes: string;
  created_at: string;
  updated_at: string;
}

export interface WeightEntry {
  id: string;
  pet_id: string;
  weighed_on: string; // ISO date
  weight_kg: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  pet_id: string;
  author_id: string;
  note: string; // <= 280 chars
  photo_url: string | null;
  taken_at: string; // ISO datetime
  location_label: string | null;
  weather_label: string | null;
  favorite: boolean;
  created_at: string;
}

export interface HealthEntry {
  id: string;
  pet_id: string;
  kind: HealthKind;
  title: string; // reason / vaccine name / med name / "Emergency"
  occurred_on: string; // ISO date
  weight_kg: number | null;
  note: string;
  cost: number | null;
  next_due_on: string | null; // vaccinations
  dosage: string | null; // medications
  schedule: string | null; // medications
  ends_on: string | null; // medications
  remind: boolean;
  notification_id: string | null; // expo-notifications id for medication reminders
  photo_url: string | null; // emergency bill/document
  created_at: string;
}

export interface CareAction {
  id: string;
  pet_id: string;
  kind: CareActionKind;
  done_by: string;
  done_by_label: string;
  done_at: string;
  note: string | null;
}

export interface CareCard {
  id: string;
  pet_id: string;
  token: string;
  label: string;
  payload: Record<string, string>;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface PetMember {
  id: string;
  pet_id: string;
  user_id: string | null;
  email: string;
  role: PetRole;
  created_at: string;
}

export interface Invitation {
  id: string;
  pet_id: string;
  email: string;
  role: PetRole;
  token: string;
  accepted: boolean;
  created_at: string;
}

export interface OnThisDayItem {
  entry: JournalEntry;
  yearsAgo: number;
}

export const HEALTH_LABEL: Record<HealthKind, string> = {
  vet_visit: 'Vet visit',
  vaccination: 'Vaccination',
  medication: 'Medication',
  emergency: 'Emergency',
};

export const CARE_ACTION_LABEL: Record<CareActionKind, string> = {
  fed: 'Fed',
  walked: 'Walked',
  meds: 'Meds given',
};
