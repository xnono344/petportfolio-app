export function todayKey(d = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateOnly(iso: string | null | undefined): string {
  if (!iso) return '';
  const candidate = iso.slice(0, 10);
  return parseDate(candidate) ? candidate : '';
}

function parseDate(iso: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const local = new Date(year, month - 1, day);
    if (
      local.getFullYear() !== year ||
      local.getMonth() !== month - 1 ||
      local.getDate() !== day
    ) {
      return null;
    }
    return local;
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDate(value) !== null;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function ageString(birthIso: string | null | undefined, now = new Date()): string {
  if (!birthIso) return '';
  const b = parseDate(birthIso);
  if (!b) return '';
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0) return months <= 1 ? '1 month old' : `${months} months old`;
  if (years === 1 && months === 0) return '1 year old';
  if (months === 0) return `${years} ${years === 1 ? 'year' : 'years'} old`;
  return `${years}y ${months}m old`;
}

export function yearsAgoLabel(yearsAgo: number): string {
  if (yearsAgo === 1) return '1 year ago today';
  return `${yearsAgo} years ago today`;
}

export function monthDay(iso: string): string {
  const d = parseDate(iso);
  if (!d) return '';
  return `${d.getMonth()}-${d.getDate()}`;
}
