// Live events: local dates and Monday-start weeks as pure string functions (no time zone / DST maths).
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isDateKey, todayKey, weekdayOf, weekIndex, weekOf } from '../../src/office/core/live';

describe('live dates', () => {
  it('todayKey is the local calendar date (late evening and just after midnight)', () => {
    expect(todayKey(new Date(2026, 10, 16, 23, 59, 59))).toBe('2026-11-16');
    expect(todayKey(new Date(2026, 10, 17, 0, 0, 1))).toBe('2026-11-17');
    expect(todayKey(new Date(2027, 0, 5, 12))).toBe('2027-01-05');
  });

  it('isDateKey accepts real calendar dates only', () => {
    for (const ok of ['2026-11-16', '2024-02-29', '2000-02-29']) expect(isDateKey(ok), ok).toBe(true);
    for (const bad of ['2026-02-29', '1900-02-29', '2026-13-01', '2026-11-31', '2026-1-01', '20261116', '', null, 3, '2026-11-16T00:00']) {
      expect(isDateKey(bad), String(bad)).toBe(false);
    }
  });

  it('addDays crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-11-16', 365)).toBe('2027-11-16');
    // the DST weekend of other zones is just another day here
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('weekdayOf: Monday = 0 … Sunday = 6', () => {
    expect(weekdayOf('2026-11-16')).toBe(0); // Monday
    expect(weekdayOf('2026-11-22')).toBe(6); // Sunday
    expect(weekdayOf('2027-01-01')).toBe(4); // Friday
    expect(weekdayOf('2024-02-29')).toBe(3); // Thursday
  });

  it('weekOf is the Monday, across month and year ends', () => {
    expect(weekOf('2026-11-16')).toBe('2026-11-16');
    expect(weekOf('2026-11-22')).toBe('2026-11-16');
    expect(weekOf('2026-11-23')).toBe('2026-11-23');
    expect(weekOf('2026-12-03')).toBe('2026-11-30');
    expect(weekOf('2027-01-03')).toBe('2026-12-28'); // Sunday after new year → the Monday in December
    expect(weekOf('2027-01-04')).toBe('2027-01-04');
  });

  it('daysBetween and weekIndex step evenly', () => {
    expect(daysBetween('2026-11-16', '2026-11-23')).toBe(7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-23', '2026-11-16')).toBe(-7);
    expect(weekIndex('2026-11-23') - weekIndex('2026-11-16')).toBe(1);
    expect(weekIndex('2027-01-04') - weekIndex('2026-12-28')).toBe(1);
    expect(weekIndex(weekOf('2026-11-19'))).toBe(weekIndex('2026-11-16'));
  });
});
