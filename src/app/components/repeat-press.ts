import { Directive, OnDestroy, output } from '@angular/core';

/**
 * Fires `repeatPress` once on press, then repeatedly while held (touch or mouse), like a native
 * stepper. Keyboard/assistive "clicks" fire once.
 */
@Directive({
  selector: '[appRepeatPress]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointerup)': 'stop()',
    '(pointerleave)': 'stop()',
    '(pointercancel)': 'stop()',
    '(click)': 'onClick()',
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class RepeatPress implements OnDestroy {
  readonly repeatPress = output<void>();
  private delay?: ReturnType<typeof setTimeout>;
  private timer?: ReturnType<typeof setInterval>;
  private fromPointer = false;

  protected start(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault(); // keep focus (and the keyboard) where it is
    this.fromPointer = true;
    this.repeatPress.emit();
    this.stop(false);
    this.delay = setTimeout(() => (this.timer = setInterval(() => this.repeatPress.emit(), 70)), 450);
  }

  protected stop(resetPointer = false): void {
    clearTimeout(this.delay);
    clearInterval(this.timer);
    if (resetPointer) this.fromPointer = false;
  }

  protected onClick(): void {
    // A pointer press already fired; a click without one (keyboard, screen reader) fires once.
    if (!this.fromPointer) this.repeatPress.emit();
    this.fromPointer = false;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
