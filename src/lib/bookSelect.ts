import type { JournalEntry } from '../types';

export interface BookPage {
  entries: JournalEntry[];
}

/**
 * Pick up to ~60 photos spread across the year.
 * Priority: favorites > entries with notes > recency spread, bucketed by month.
 */
export function selectMemoryBookPhotos(entries: JournalEntry[], year: number, max = 60): JournalEntry[] {
  const inYear = entries.filter(
    (e) => e.photo_url && new Date(e.taken_at).getFullYear() === year,
  );
  if (!inYear.length) return [];

  const score = (e: JournalEntry) => {
    let s = 0;
    if (e.favorite) s += 100;
    if (e.note?.trim()) s += 40 + Math.min(20, e.note.trim().length / 10);
    if (e.weather_label || e.location_label) s += 5;
    return s;
  };

  // Bucket by month to force spread, then take best per bucket round-robin.
  const byMonth: JournalEntry[][] = Array.from({ length: 12 }, () => []);
  inYear.forEach((e) => {
    byMonth[new Date(e.taken_at).getMonth()].push(e);
  });
  byMonth.forEach((bucket) => bucket.sort((a, b) => score(b) - score(a)));

  const picked: JournalEntry[] = [];
  const seen = new Set<string>();
  let round = 0;
  let progressed = true;
  while (picked.length < max && progressed) {
    progressed = false;
    for (let m = 0; m < 12 && picked.length < max; m++) {
      const bucket = byMonth[m];
      if (round < bucket.length) {
        const e = bucket[round];
        if (!seen.has(e.photo_url! + e.id)) {
          seen.add(e.photo_url! + e.id);
          picked.push(e);
          progressed = true;
        }
      }
    }
    round += 1;
  }
  // Fill remainder with highest-scoring leftovers.
  if (picked.length < max) {
    const rest = inYear
      .filter((e) => !picked.includes(e))
      .sort((a, b) => score(b) - score(a));
    for (const e of rest) {
      if (picked.length >= max) break;
      picked.push(e);
    }
  }
  return picked.sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1));
}

export function paginateBook(picked: JournalEntry[]): BookPage[] {
  // 1–4 photos per page: favorites get a hero page, others up to 4.
  const pages: BookPage[] = [];
  let i = 0;
  while (i < picked.length) {
    const e = picked[i];
    if (e.favorite && i + 1 < picked.length) {
      pages.push({ entries: [e] });
      i += 1;
    } else {
      pages.push({ entries: picked.slice(i, i + 4) });
      i += 4;
    }
    if (pages.length >= 30) break; // ~32 pages incl. cover/closing
  }
  return pages;
}
