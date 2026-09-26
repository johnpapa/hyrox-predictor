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
    type(el, '16');
    type(el, '162');
    f.componentRef.setInput('value', 16 / 2.20462); // echo of "16" arrives late
    await f.whenStable();
    expect(el.value).toBe('162');
  });
});
