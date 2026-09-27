import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Disclaimer & privacy. Plain-language versions of the usual notices: unofficial, estimates only,
 * not medical advice, provided "as is" (matches the MIT licence), and what happens to your data.
 */
@Component({
  selector: 'app-disclaimer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="panel disc" id="disclaimer" [open]="open()">
      <summary>
        <span class="label">Disclaimer &amp; privacy</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" /></svg>
      </summary>
      <div class="body">
        <p><b>Unofficial.</b> HYROX Predictor is an independent, fan-made tool. It is not affiliated with, endorsed by,
          sponsored by or approved by HYROX or its organisers. HYROX is a trademark of its owner and is used only to
          describe what this tool is for.</p>
        <p><b>Estimates only, no guarantees.</b> Predictions are estimates based on public race data and published
          research, for general information and entertainment. They are not guaranteed to be accurate or complete, and your
          real result may be very different.</p>
        <p><b>Not medical or training advice.</b> Nothing here is medical, health, fitness or professional advice. Check with
          a doctor or qualified coach before starting or changing training. You train and race at your own risk.</p>
        <p><b>Provided "as is".</b> The app and its source code are provided "as is", without warranty of any kind, express
          or implied. To the fullest extent permitted by law, the author accepts no liability for any loss, damage or injury
          arising from its use.</p>
        <p><b>Your privacy.</b> No accounts, no sign-up, no server, no database, no cookies, no analytics, no ads and no
          tracking. The app runs entirely in your browser: nothing you enter is sent anywhere or seen by anyone, including
          the author. If you tick <i>Save my inputs on this device</i>, your inputs are kept only in this browser's local
          storage; untick it, or clear your browser data, to delete them. The site is hosted on GitHub Pages, which (like
          any web host) may keep basic technical logs such as IP addresses under GitHub's privacy statement; the app itself
          collects nothing.</p>
      </div>
    </details>
  `,
  styles: `
    .disc { padding: 0; text-align: left; }
    summary {
      list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; min-height: 48px;
      &::-webkit-details-marker { display: none; }
      .label { color: var(--text); font-size: 0.9rem; }
      svg { width: 18px; height: 18px; color: var(--accent); transition: transform 0.2s; }
    }
    details[open] summary svg { transform: rotate(180deg); }
    .body { padding: 0 18px 16px; color: var(--text-dim); font-size: 0.85rem; line-height: 1.5;
      p { margin: 0 0 10px; } b { color: var(--text); font-weight: 600; } }
  `,
})
export class Disclaimer {
  readonly open = input(false);
}
