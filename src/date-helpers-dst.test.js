// Date helpers must not lose a day when the addition crosses an Australian daylight-saving boundary.
// The old local-time setMonth + toISOString pattern returned 12/10 for 13/07 + 3 months in Sydney.
process.env.TZ = 'Australia/Sydney';
import { describe, it, expect } from 'vitest';
import { addMonthsISO, addYearsISO, addTATMonths, swbAddYear, irtAddYear } from './App.jsx';

describe('DST-safe date maths (Australia/Sydney)', () => {
  it('sanity: the process really is on a DST timezone', () => {
    expect(new Date('2026-01-15T00:00:00Z').getTimezoneOffset()).toBe(-660);
    expect(new Date('2026-07-15T00:00:00Z').getTimezoneOffset()).toBe(-600);
  });
  it('addTATMonths crosses DST without losing a day', () => {
    expect(addTATMonths('2026-07-13', 3)).toBe('2026-10-13');
    expect(addTATMonths('2026-09-24', 3)).toBe('2026-12-24');
    expect(addTATMonths('2026-04-05', 6)).toBe('2026-10-05');
  });
  it('addMonthsISO / addYearsISO cross DST without losing a day', () => {
    expect(addMonthsISO('2026-07-13', 3)).toBe('2026-10-13');
    expect(addYearsISO('2026-10-05', 1)).toBe('2027-10-05');
  });
  it('swbAddYear / irtAddYear (display strings) keep the same calendar day across DST', () => {
    expect(swbAddYear('2026-10-05')).toBe('05/10/2027');
    expect(swbAddYear('2026-04-05')).toBe('05/04/2027');
    expect(irtAddYear('2026-10-05')).toBe('05/10/2027');
    expect(irtAddYear('2026-04-05')).toBe('05/04/2027');
  });
});
