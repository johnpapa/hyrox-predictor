import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the predicted finish and all 16 splits', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.clock')?.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(el.querySelectorAll('.split').length).toBe(16);
    expect(el.textContent).toContain('Roxzone Time');
  });
});
