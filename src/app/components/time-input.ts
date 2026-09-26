import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { formatTime, parseTime } from '../core/time';

let nextId = 0;

/**
 * Text input that accepts mm:ss / h:mm:ss (or plain minutes) and emits seconds.
 * While typing, the text is never rewritten from the model — only when the model changes to
 * a value the text doesn't already represent (e.g. a reset), and on blur.
 */
@Component({
  selector: 'app-time-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label class="label" [for]="id">{{ label() }}</label>
      <input
        [id]="id"
        [attr.aria-describedby]="invalid() || hint() ? id + '-hint' : null"
        type="text"
        autocomplete="off"
        spellcheck="false"
        [placeholder]="placeholder()"
        [value]="text()"
        [class.invalid]="invalid()"
        [attr.aria-invalid]="invalid()"
        (input)="onInput($any($event.target).value)"
        (blur)="onBlur()"
      />
      @if (invalid()) {
        <span class="hint warn" [id]="id + '-hint'">Use mm:ss or h:mm:ss</span>
      } @else if (hint()) {
        <span class="hint" [id]="id + '-hint'">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .invalid { border-color: var(--warn) !important; }
    .warn { color: var(--warn) !important; }
  `,
})
export class TimeInput {
  protected readonly id = `time-${nextId++}`;
  readonly label = input.required<string>();
  readonly seconds = input<number | null>(null);
  readonly placeholder = input('mm:ss');
  readonly hint = input<string>('');
  readonly secondsChange = output<number | null>();

  protected readonly text = linkedSignal<number | null, string>({
    source: this.seconds,
    computation: (s, prev) => {
      // Keep the user's text if it already means this value (they're mid-typing).
      if (prev && (parseTime(prev.value) === s || (prev.value.trim() === '' && s == null))) return prev.value;
      return s == null ? '' : formatTime(s);
    },
  });
  protected readonly invalid = computed(() => this.text().trim() !== '' && parseTime(this.text()) == null);

  protected onInput(v: string): void {
    this.text.set(v);
    if (v.trim() === '') this.secondsChange.emit(null);
    else {
      const parsed = parseTime(v);
      if (parsed != null) this.secondsChange.emit(parsed);
    }
  }

  protected onBlur(): void {
    const s = this.seconds();
    if (!this.invalid()) this.text.set(s == null ? '' : formatTime(s));
  }
}
