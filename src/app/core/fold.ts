import { Injectable, signal } from '@angular/core';

/**
 * Which sections are collapsed. UI state only: kept in memory, never saved, so it doesn't touch
 * the privacy promise. Keys are stable section names (e.g. "card:Leg strength").
 */
@Injectable({ providedIn: 'root' })
export class FoldState {
  private readonly closed = signal<ReadonlySet<string>>(new Set());

  isOpen(key: string): boolean {
    return !this.closed().has(key);
  }

  toggle(key: string): void {
    this.set([key], !this.isOpen(key));
  }

  /** Open or close several sections at once (e.g. "Collapse all cards"). */
  set(keys: readonly string[], open: boolean): void {
    this.closed.update((s) => {
      const n = new Set(s);
      for (const k of keys) {
        if (open) n.delete(k);
        else n.add(k);
      }
      return n;
    });
  }

  allOpen(keys: readonly string[]): boolean {
    return keys.every((k) => this.isOpen(k));
  }
}
