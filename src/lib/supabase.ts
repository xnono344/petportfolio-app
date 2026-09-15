import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureStorage, migrateLegacySession } from './secureStore';

export type Json = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: Json }
export type JsonArray = Json[];

export interface Database {
  public: {
    Tables: {
      pets: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          species: string;
          breed: string;
          photo_url: string | null;
          birth_date: string | null;
          weight_kg: number | string | null;
          allergies: string;
          conditions: string;
          vet_name: string;
          vet_phone: string;
          emergency_contact: string;
          feeding_notes: string;
          care_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner_id: string;
          name: string;
          species: string;
          breed?: string;
          photo_url?: string | null;
          birth_date?: string | null;
          weight_kg?: number | string | null;
          allergies?: string;
          conditions?: string;
          vet_name?: string;
          vet_phone?: string;
          emergency_contact?: string;
          feeding_notes?: string;
          care_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          species?: string;
          breed?: string;
          photo_url?: string | null;
          birth_date?: string | null;
          weight_kg?: number | string | null;
          allergies?: string;
          conditions?: string;
          vet_name?: string;
          vet_phone?: string;
          emergency_contact?: string;
          feeding_notes?: string;
          care_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pets_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      weight_entries: {
        Row: {
          id: string;
          pet_id: string;
          weighed_on: string;
          weight_kg: number | string;
          created_at: string;
        };
        Insert: {
          id: string;
          pet_id: string;
          weighed_on: string;
          weight_kg: number | string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pet_id?: string;
          weighed_on?: string;
          weight_kg?: number | string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weight_entries_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      journal_entries: {
        Row: {
          id: string;
          pet_id: string;
          author_id: string;
          note: string;
          photo_url: string | null;
          taken_at: string;
          location_label: string | null;
          weather_label: string | null;
          favorite: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          pet_id: string;
          author_id: string;
          note?: string;
          photo_url?: string | null;
          taken_at?: string;
          location_label?: string | null;
          weather_label?: string | null;
          favorite?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pet_id?: string;
          author_id?: string;
          note?: string;
          photo_url?: string | null;
          taken_at?: string;
          location_label?: string | null;
          weather_label?: string | null;
          favorite?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'journal_entries_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      health_entries: {
        Row: {
          id: string;
          pet_id: string;
          kind: string;
          title: string;
          occurred_on: string;
          weight_kg: number | string | null;
          note: string;
          cost: number | string | null;
          next_due_on: string | null;
          dosage: string | null;
          schedule: string | null;
          ends_on: string | null;
          remind: boolean;
          notification_id: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          pet_id: string;
          kind: string;
          title?: string;
          occurred_on?: string;
          weight_kg?: number | string | null;
          note?: string;
          cost?: number | string | null;
          next_due_on?: string | null;
          dosage?: string | null;
          schedule?: string | null;
          ends_on?: string | null;
          remind?: boolean;
          notification_id?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pet_id?: string;
          kind?: string;
          title?: string;
          occurred_on?: string;
          weight_kg?: number | string | null;
          note?: string;
          cost?: number | string | null;
          next_due_on?: string | null;
          dosage?: string | null;
          schedule?: string | null;
          ends_on?: string | null;
          remind?: boolean;
          notification_id?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'health_entries_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      care_actions: {
        Row: {
          id: string;
          pet_id: string;
          kind: string;
          done_by: string;
          done_by_label: string;
          done_at: string;
          note: string | null;
        };
        Insert: {
          id: string;
          pet_id: string;
          kind: string;
          done_by?: string;
          done_by_label?: string;
          done_at?: string;
          note?: string | null;
        };
        Update: {
          id?: string;
          pet_id?: string;
          kind?: string;
          done_by?: string;
          done_by_label?: string;
          done_at?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'care_actions_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      care_cards: {
        Row: {
          id: string;
          pet_id: string;
          token: string;
          label: string;
          payload: Json;
          expires_at: string | null;
          revoked: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          pet_id: string;
          token: string;
          label?: string;
          payload?: Json;
          expires_at?: string | null;
          revoked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pet_id?: string;
          token?: string;
          label?: string;
          payload?: Json;
          expires_at?: string | null;
          revoked?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'care_cards_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      pet_members: {
        Row: {
          id: string;
          pet_id: string;
          user_id: string | null;
          email: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          pet_id: string;
          user_id?: string | null;
          email: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pet_id?: string;
          user_id?: string | null;
          email?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pet_members_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          pet_id: string;
          email: string;
          role: string;
          token: string;
          accepted: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          pet_id: string;
          email: string;
          role: string;
          token: string;
          accepted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pet_id?: string;
          email?: string;
          role?: string;
          token?: string;
          accepted?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_pet_id_fkey';
            columns: ['pet_id'];
            isOneToOne: false;
            referencedRelation: 'pets';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured =
  !!url && !!anon && url.startsWith('http') && anon.length > 20;

let client: SupabaseClient<Database> | null = null;
let sessionMigrated = false;

export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  // Once, drain any session token the legacy insecure config left in AsyncStorage
  // into SecureStore so live JWT/refresh tokens are never left world-readable.
  if (!sessionMigrated) {
    void migrateLegacySession();
    sessionMigrated = true;
  }
  client = createClient<Database>(url!, anon!, {
    auth: {
      // Auth session tokens are secrets: persist them via SecureStore
      // (iOS Keychain / Android Keystore), never AsyncStorage.
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export const CARE_CARD_BASE_URL =
  process.env.EXPO_PUBLIC_CARE_CARD_BASE_URL?.trim() || 'https://petportfolio.app';
