import { checkNumber, timeError } from './validate';

describe('checkNumber', () => {
  it('accepts blank (not sure), decimals and comma decimals', () => {
    expect(checkNumber('')).toEqual({ ok: true, value: null });
    expect(checkNumber(' 22.5 ')).toEqual({ ok: true, value: 22.5 });
    expect(checkNumber('22,5')).toEqual({ ok: true, value: 22.5 });
    expect(checkNumber('7.')).toEqual({ ok: true, value: 7 });
  });

  it('explains what is wrong: not a number, negative, not whole, zero', () => {
    expect(checkNumber('abc')).toMatchObject({ ok: false, error: expect.stringContaining('Enter a number') });
    expect(checkNumber('12kg')).toMatchObject({ ok: false });
    expect(checkNumber('-5')).toEqual({ ok: false, error: "Can't be negative" });
    expect(checkNumber('7.5', { integer: true })).toMatchObject({ ok: false, error: expect.stringContaining('whole number') });
    expect(checkNumber('0')).toEqual({ ok: false, error: 'Must be more than 0' });
    expect(checkNumber('0', { allowZero: true })).toEqual({ ok: true, value: 0 });
  });
});

describe('timeError', () => {
  it('accepts blank, mm:ss, h:mm:ss and plain minutes', () => {
    for (const t of ['', '4:30', '1:05:00', '25', '0:45']) expect(timeError(t)).toBeNull();
  });

  it('explains bad times', () => {
    expect(timeError('4:75')).toBe('Minutes and seconds must be 0–59');
    expect(timeError('1:75:00')).toBe('Minutes and seconds must be 0–59');
    expect(timeError('abc')).toContain('Use mm:ss or h:mm:ss');
    expect(timeError('4:30:10:5')).toContain('Use mm:ss or h:mm:ss');
    expect(timeError('-4:30')).toBe("Time can't be negative");
    expect(timeError('0:00')).toBe('Must be more than 0:00');
    expect(timeError('0')).toBe('Must be more than 0:00');
  });
});
