import assert from 'node:assert/strict';
import test from 'node:test';
import { ageString, isValidDateOnly, monthDay, todayKey, toDateOnly } from './dates.ts';

test('todayKey uses the local calendar day instead of UTC', () => {
  process.env.TZ = 'Pacific/Kiritimati';
  const localMidnight = new Date(2026, 8, 15, 0, 30);
  assert.equal(todayKey(localMidnight), '2026-09-15');
});

test('date-only values keep their calendar day west of UTC', () => {
  process.env.TZ = 'Pacific/Honolulu';
  assert.equal(monthDay('2026-09-15'), '8-15');
  assert.equal(ageString('2024-01-01', new Date(2025, 0, 1, 12)), '1 year old');
});

test('toDateOnly rejects malformed values', () => {
  assert.equal(toDateOnly('2026-09-15T12:00:00.000Z'), '2026-09-15');
  assert.equal(toDateOnly('not-a-date'), '');
});

test('date-only validation rejects rolled and malformed calendar dates', () => {
  assert.equal(isValidDateOnly('2024-02-29'), true);
  assert.equal(isValidDateOnly('2025-02-29'), false);
  assert.equal(isValidDateOnly('2026-13-01'), false);
  assert.equal(isValidDateOnly('09/15/2026'), false);
});
