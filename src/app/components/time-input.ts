import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { formatTime, parseTime } from '../core/time';

/** Text input that accepts mm:ss / h:mm:ss (or plain minutes) and emits seconds. */
@Component({
  selector: 'app-time-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field">
      <span class="label">{{ label() }}</span>
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="text()"
        [class.invalid]="invalid()"
        (input)="onInput($any($event.target).value)"
        (blur)="onBlur()"
      />
      @if (hint()) { <span class="hint">{{ hint() }}</span> }
    </label>
  `,
  styles: `.invalid { border-color: var(--warn) !important; }`,
})
export class TimeInput {
  readonly label = input.required<string>();
  readonly seconds = input<number | null>(null);
  readonly placeholder = input('mm:ss');
  readonly hint = input<string>('');
  readonly secondsChange = output<number | null>();

  protected readonly text = linkedSignal(() => {
    const s = this.seconds();
    return s == null ? '' : formatTime(s);
  });
  protected readonly invalid = computed(() => this.text().trim() !== '' && parseTime(this.text()) == null);

  protected onInput(v: string): void {
    this.text.set(v);
    const parsed = parseTime(v);
    if (v.trim() === '') this.secondsChange.emit(null);
    else if (parsed != null) this.secondsChange.emit(parsed);
  }

  protected onBlur(): void {
    const s = this.seconds();
    if (!this.invalid()) this.text.set(s == null ? '' : formatTime(s));
  }
}
