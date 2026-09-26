import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { formatTime, parseTime } from '../core/time';
import { RepeatPress } from './repeat-press';

let nextId = 0;

/**
 * Text input that accepts mm:ss / h:mm:ss (or plain minutes) and emits seconds, with −/+ steppers,
 * arrow keys (Shift × 10) and an inline check against the plausible range.
 * While typing, the text is never rewritten from the model — only when the model changes to
 * a value the text doesn't already represent (e.g. a reset), and on blur.
 */
@Component({
  selector: 'app-time-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RepeatPress],
  template: `
    <div class="field">
      <label class="label" [for]="id">{{ label() }}</label>
      <div class="stepper">
        <button type="button" class="step" tabindex="-1" aria-label="Decrease" [attr.aria-controls]="id"
          [disabled]="atMin()" appRepeatPress (repeatPress)="stepBy(-1)">−</button>
        <input
          [id]="id"
          [attr.aria-describedby]="message() || hint() ? id + '-hint' : null"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [placeholder]="placeholder()"
          [value]="text()"
          [class.invalid]="!!message()"
          [attr.aria-invalid]="!!message()"
          (input)="onInput($any($event.target).value)"
          (keydown)="onKey($event)"
          (blur)="onBlur()"
        />
        <button type="button" class="step" tabindex="-1" aria-label="Increase" [attr.aria-controls]="id"
          [disabled]="atMax()" appRepeatPress (repeatPress)="stepBy(1)">+</button>
      </div>
      @if (message(); as m) {
        <span class="hint warn" [id]="id + '-hint'" role="alert">{{ m }}</span>
      } @else if (hint()) {
        <span class="hint" [id]="id + '-hint'">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .invalid { border-color: var(--warn) !important; }
    .warn { color: var(--warn) !important; }
    .stepper { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; }
    .stepper input { border-radius: 0; text-align: center; padding-left: 4px; padding-right: 4px; }
    .step {
      min-height: 44px; border: 1px solid var(--line-strong); background: var(--bg-elev); color: var(--text);
      font-size: 1.1rem; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none;
    }
    .step:first-child { border-right: 0; border-radius: var(--radius) 0 0 var(--radius); }
    .step:last-child { border-left: 0; border-radius: 0 var(--radius) var(--radius) 0; }
    .step:hover:not(:disabled) { color: var(--accent); }
    .step:disabled { color: var(--text-faint); cursor: default; }
  `,
})
export class TimeInput {
  protected readonly id = `time-${nextId++}`;
  readonly label = input.required<string>();
  readonly seconds = input<number | null>(null);
  readonly placeholder = input('mm:ss');
  readonly hint = input<string>('');
  /** Plausible range (seconds); times outside it are ignored by the model, so say so. */
  readonly range = input<readonly [number, number] | null>(null);
  /** −/+ step in seconds. */
  readonly step = input(5);
  /** Time the first press starts from when the field is empty (seconds). */
  readonly start = input<number | null>(null);
  readonly secondsChange = output<number | null>();

  /**
   * Values this field emitted that the parent hasn't echoed back yet. On a slow device an echo can
   * arrive after later keystrokes, and it must never rewrite what the user has typed since.
   */
  private pending: (number | null)[] = [];

  /** True (and consumed) if `v` is the echo of something this field emitted. */
  private isEcho(v: number | null): boolean {
    const i = this.pending.findIndex((p) => p === v || (p != null && v != null && Math.abs(p - v) < 1e-9));
    if (i < 0) return false;
    this.pending.splice(0, i + 1);
    return true;
  }

  protected readonly text = linkedSignal<number | null, string>({
    source: this.seconds,
    computation: (s, prev) => {
      // Keep the user's text if it already means this value (they're mid-typing), or if this is
      // the late echo of a value we emitted a keystroke or two ago (slow devices).
      if (prev && (this.isEcho(s) || parseTime(prev.value) === s || (prev.value.trim() === '' && s == null))) return prev.value;
      return s == null ? '' : formatTime(s);
    },
  });
  protected readonly invalid = computed(() => this.text().trim() !== '' && parseTime(this.text()) == null);

  protected readonly message = computed(() => {
    if (this.invalid()) return 'Use mm:ss or h:mm:ss';
    const s = this.seconds(), r = this.range();
    if (s == null || !r || (s >= r[0] && s <= r[1])) return '';
    return `${formatTime(s)} isn't realistic, so it's ignored (expected ${formatTime(r[0])}–${formatTime(r[1])})`;
  });

  protected readonly atMin = computed(() => {
    const s = this.seconds(), r = this.range();
    return s != null && r != null && s <= r[0];
  });
  protected readonly atMax = computed(() => {
    const s = this.seconds(), r = this.range();
    return s != null && r != null && s >= r[1];
  });

  protected onInput(v: string): void {
    this.text.set(v);
    if (v.trim() === '') this.emit(null);
    else {
      const parsed = parseTime(v);
      if (parsed != null) this.emit(parsed);
    }
  }

  protected stepBy(dir: number, n = 1): void {
    const step = this.step();
    const cur = this.seconds();
    let s: number;
    if (cur == null) s = Math.round((this.start() ?? this.range()?.[0] ?? 60) / step) * step;
    else if (cur % step !== 0) s = (dir > 0 ? Math.ceil(cur / step) : Math.floor(cur / step)) * step + dir * (n - 1) * step;
    else s = cur + dir * n * step;
    const r = this.range();
    if (r) s = Math.min(r[1], Math.max(r[0], s));
    s = Math.max(step, s);
    this.text.set(formatTime(s));
    this.emit(s);
  }

  private emit(s: number | null): void {
    this.pending.push(s);
    this.secondsChange.emit(s);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    this.stepBy(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1);
  }

  protected onBlur(): void {
    this.pending = [];
    const s = this.seconds();
    if (!this.invalid()) this.text.set(s == null ? '' : formatTime(s));
  }
}
