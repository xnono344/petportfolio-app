import type { HealthEntry, Pet, WeightEntry } from '../types';
import { speciesInfo } from '../types';
import { formatDate } from '../utils/dates';

function esc(s: string | number | null | undefined): string {
  const v = s == null ? '' : String(s);
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function section(title: string, body: string): string {
  return `<div class="sec"><h2>${esc(title)}</h2>${body}</div>`;
}

export function healthSummaryHtml(pet: Pet, weights: WeightEntry[], health: HealthEntry[]): string {
  const latestWeight =
    [...weights].sort((a, b) => (a.weighed_on < b.weighed_on ? 1 : -1))[0]?.weight_kg ??
    pet.weight_kg;
  const by = (kind: HealthEntry['kind']) =>
    health.filter((h) => h.kind === kind).sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));
  const li = (h: HealthEntry, extra = '') =>
    `<li><strong>${esc(h.title)}</strong> · ${esc(formatDate(h.occurred_on))}${extra}${h.note ? `<br/><span class="note">${esc(h.note)}</span>` : ''}</li>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; } body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #222; padding: 40px; }
    h1 { font-size: 30px; margin: 0; } .sub { color: #777; margin: 4px 0 20px; }
    .sec { margin-top: 22px; page-break-inside: avoid; } .sec h2 { font-size: 17px; border-bottom: 2px solid #E2683C; padding-bottom: 4px; }
    ul { padding-left: 18px; } li { margin: 6px 0; font-size: 14px; } .note { color: #555; }
    .grid { display: flex; gap: 24px; } .grid div { flex: 1; font-size: 14px; }
    .warn { margin-top: 28px; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
  </style></head><body>
    <h1>${esc(pet.name)} · Health Summary</h1>
    <p class="sub">${esc(speciesInfo(pet.species).label)}${pet.breed ? ` · ${esc(pet.breed)}` : ''}${pet.birth_date ? ` · Born ${esc(formatDate(pet.birth_date))}` : ''}</p>
    <div class="grid">
      <div><strong>Weight:</strong> ${latestWeight ? `${esc(latestWeight)} kg` : '—'}<br/>
      <strong>Allergies:</strong> ${esc(pet.allergies || 'None recorded')}<br/>
      <strong>Known conditions:</strong> ${esc(pet.conditions || 'None recorded')}</div>
      <div><strong>Vet:</strong> ${esc(pet.vet_name || '—')} ${esc(pet.vet_phone || '')}<br/>
      <strong>Emergency contact:</strong> ${esc(pet.emergency_contact || '—')}</div>
    </div>
    ${section('Medications', by('medication').length ? `<ul>${by('medication').map((h) => li(h, `${h.dosage ? ` · ${esc(h.dosage)}` : ''}${h.schedule ? ` · ${esc(h.schedule)}` : ''}`)).join('')}</ul>` : '<p>No medications recorded.</p>')}
    ${section('Vaccinations', by('vaccination').length ? `<ul>${by('vaccination').map((h) => li(h, `${h.next_due_on ? ` · Next due ${esc(formatDate(h.next_due_on))}` : ''}`)).join('')}</ul>` : '<p>No vaccinations recorded.</p>')}
    ${section('Vet visits', by('vet_visit').length ? `<ul>${by('vet_visit').map((h) => li(h, `${h.weight_kg ? ` · ${esc(h.weight_kg)} kg` : ''}${h.cost != null ? ` · $${esc(h.cost)}` : ''}`)).join('')}</ul>` : '<p>No vet visits recorded.</p>')}
    ${section('Emergencies', by('emergency').length ? `<ul>${by('emergency').map((h) => li(h)).join('')}</ul>` : '<p>No emergencies recorded.</p>')}
    <p class="warn">For personal use only. Not veterinary advice.<br/>Exported from PetPortfolio on ${esc(new Date().toLocaleDateString())}.</p>
  </body></html>`;
}
