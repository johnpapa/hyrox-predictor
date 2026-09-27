import { TestBed } from '@angular/core/testing';
import { NumberInput } from './number-input';
import { TimeInput } from './time-input';

/** Simulates a slow device: the parent's echo of an emitted value arrives after later keystrokes. */
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('inputs never rewrite what the user is typing', () => {
  it('REGRESSION: a late echo of "23" does not turn "23:" into "23:00" (time field)', async () => {
    const f = TestBed.createComponent(TimeInput);
    f.componentRef.setInput('label', '5K');
    const emitted: (number | null)[] = [];
    f.componentInstance.secondsChange.subscribe((v) => emitted.push(v));
    await f.whenStable();
    const el: HTMLInputElement = f.nativeElement.querySelector('input');
    type(el, '23');
    type(el, '23:'); // typed before the parent re-rendered
    f.componentRef.setInput('seconds', 23 * 60); // the late echo
    await f.whenStable();
    expect(el.value).toBe('23:');
    type(el, '23:30');
    f.componentRef.setInput('seconds', 23 * 60 + 30);
    await f.whenStable();
    expect(el.value).toBe('23:30');
    expect(emitted).toEqual([1380, 1410]);
    // A real external change (e.g. Reset) still updates the field.
    f.componentRef.setInput('seconds', null);
    await f.whenStable();
    expect(el.value).toBe('');
  });

  it('REGRESSION: a late echo does not rewrite a number mid-typing', async () => {
    const f = TestBed.createComponent(NumberInput);
    f.componentRef.setInput('label', 'Bodyweight (lb)');
    f.componentRef.setInput('factor', 2.20462);
    f.componentRef.setInput('decimals', 0);
    await f.whenStable();
    const el: HTMLInputElement = f.nativeElement.querySelector('input');
    type(el, '17');
    type(el, '175');
    f.componentRef.setInput('value', 17 / 2.20462); // echo of "17" arrives late
    await f.whenStable();
    expect(el.value).toBe('175');
  });
});

describe('input validation (red errors, shown on blur, cleared as soon as fixed)', () => {
  const msg = (f: { nativeElement: HTMLElement }) => f.nativeElement.querySelector('.field-error')?.textContent?.trim() ?? '';

  it('number: waits for blur, then explains and clears live once fixed', async () => {
    const f = TestBed.createComponent(NumberInput);
    f.componentRef.setInput('label', 'Reps');
    f.componentRef.setInput('integer', true);
    await f.whenStable();
    const el: HTMLInputElement = f.nativeElement.querySelector('input');
    type(el, '7.5');
    await f.whenStable();
    expect(msg(f)).toBe(''); // no scolding mid-typing
    el.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(msg(f)).toContain('whole number');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.classList).toContain('invalid');
    expect(el.getAttribute('aria-describedby')).toBe(f.nativeElement.querySelector('.field-error').id);
    type(el, '7');
    await f.whenStable();
    expect(msg(f)).toBe(''); // cleared on the keystroke that fixes it
    expect(el.getAttribute('aria-invalid')).toBe('false');
  });

  it('REGRESSION: an integer field no longer silently rounds 7.5 to 8', async () => {
    const f = TestBed.createComponent(NumberInput);
    f.componentRef.setInput('label', 'Reps');
    f.componentRef.setInput('integer', true);
    const emitted: (number | null)[] = [];
    f.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    await f.whenStable();
    type(f.nativeElement.querySelector('input'), '7.5');
    expect(emitted).toEqual([]);
  });

  it('number: range message uses display units once you leave the field', async () => {
    const f = TestBed.createComponent(NumberInput);
    f.componentRef.setInput('label', 'Deadlift (lb)');
    f.componentRef.setInput('units', 'lb');
    f.componentRef.setInput('factor', 2.20462);
    f.componentRef.setInput('decimals', 0);
    f.componentRef.setInput('range', [20, 400]);
    await f.whenStable();
    const el: HTMLInputElement = f.nativeElement.querySelector('input');
    type(el, '9');
    f.componentRef.setInput('value', 9 / 2.20462);
    await f.whenStable();
    expect(msg(f)).toBe('');
    el.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(msg(f)).toMatch(/^Enter 44–882 lb\. 9 lb isn't realistic/);
  });

  it('time: bad seconds are explained on blur and cleared once fixed', async () => {
    const f = TestBed.createComponent(TimeInput);
    f.componentRef.setInput('label', '5K');
    const emitted: (number | null)[] = [];
    f.componentInstance.secondsChange.subscribe((v) => emitted.push(v));
    await f.whenStable();
    const el: HTMLInputElement = f.nativeElement.querySelector('input');
    type(el, '24:75');
    await f.whenStable();
    expect(msg(f)).toBe('');
    el.dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(msg(f)).toBe('Minutes and seconds must be 0–59');
    type(el, '24:50');
    await f.whenStable();
    expect(msg(f)).toBe('');
    expect(emitted).toEqual([1490]);
  });

  it('time: a saved out-of-range value shows its message straight away', async () => {
    const f = TestBed.createComponent(TimeInput);
    f.componentRef.setInput('label', '5K');
    f.componentRef.setInput('range', [720, 3600]);
    f.componentRef.setInput('seconds', 300);
    await f.whenStable();
    expect(msg(f)).toBe("Enter 12:00–01:00:00. 05:00 isn't realistic, so it's ignored");
  });
});
