import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { JournalEntry, Pet } from '../types';
import { formatDate } from '../utils/dates';
import { selectMemoryBookPhotos, paginateBook } from './bookSelect';
import { resolveStoredImageUri } from './images';

export { selectMemoryBookPhotos, paginateBook };
export type { BookPage } from './bookSelect';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function memoryBookHtml(pet: Pet, year: number, pages: import('./bookSelect').BookPage[]): string {
  const coverPhoto = pages[0]?.entries[0]?.photo_url ?? pet.photo_url ?? null;
  const pageHtml = pages
    .map((p, idx) => {
      const cells = p.entries
        .map((e) => {
          const big = p.entries.length === 1;
          return `<figure class="ph ${big ? 'hero' : ''}">
            <img src="${esc(e.photo_url!)}" />
            <figcaption>
              <span class="d">${esc(formatDate(e.taken_at))}</span>
              ${e.note ? `<span class="n">${esc(e.note)}</span>` : ''}
            </figcaption>
          </figure>`;
        })
        .join('');
      return `<section class="page"><div class="num">${idx + 1}</div><div class="grid g${p.entries.length}">${cells}</div></section>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2B2320; }
    .cover { width: 100%; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FFF6EE; text-align: center; page-break-after: always; }
    .cover img { width: 62%; aspect-ratio: 1; object-fit: cover; border-radius: 28px; }
    .cover h1 { font-size: 44px; margin-top: 28px; }
    .cover p { font-size: 20px; color: #8A7B70; margin-top: 8px; letter-spacing: 2px; text-transform: uppercase; }
    .page { width: 100%; min-height: 92vh; padding: 36px; page-break-after: always; position: relative; }
    .num { position: absolute; bottom: 18px; right: 28px; color: #B9A99D; font-size: 13px; }
    .grid { display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; }
    .ph { background: #fff; border-radius: 18px; overflow: hidden; border: 1px solid #F0E2D3; }
    .g1 .ph { width: 92%; } .g2 .ph { width: 46%; } .g3 .ph, .g4 .ph { width: 46%; }
    .ph img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .hero img { aspect-ratio: 1; }
    figcaption { padding: 12px 14px; }
    .d { display: block; font-size: 12px; color: #8A7B70; letter-spacing: 1px; text-transform: uppercase; }
    .n { display: block; font-size: 16px; margin-top: 4px; line-height: 1.4; }
    .closing { text-align: center; padding: 120px 40px; }
    .closing h2 { font-size: 30px; } .closing p { color: #8A7B70; margin-top: 10px; font-size: 16px; }
  </style></head><body>
  <div class="cover">
    ${coverPhoto ? `<img src="${esc(coverPhoto)}" />` : ''}
    <h1>${esc(pet.name)}'s ${year} Adventure Book</h1>
    <p>A year of little moments</p>
  </div>
  ${pageHtml}
  <div class="closing"><h2>The end of ${year}…</h2><p>Made with love in PetPortfolio. For personal use only.</p></div>
  </body></html>`;
}

export async function generateMemoryBookPdf(
  pet: Pet,
  year: number,
  entries: JournalEntry[],
): Promise<string> {
  const picked = selectMemoryBookPhotos(entries, year);
  if (!picked.length) throw new Error(`No photos from ${year} yet. Add journal photos to build a book.`);
  const resolvedEntries = await Promise.all(
    picked.map(async (entry) => ({
      ...entry,
      photo_url: await resolveStoredImageUri(entry.photo_url),
    })),
  );
  const resolvedPet = {
    ...pet,
    photo_url: await resolveStoredImageUri(pet.photo_url),
  };
  const pages = paginateBook(resolvedEntries);
  const html = memoryBookHtml(resolvedPet, year, pages);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function sharePdf(uri: string, dialogTitle = 'Share PDF'): Promise<void> {
  const canShare = await Sharing.isAvailableAsync().catch(() => false);
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { dialogTitle, mimeType: 'application/pdf' });
}
