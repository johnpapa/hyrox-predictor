# AGENTS.md

Guidance for AI coding agents (Claude Code, GitHub Copilot, Cursor, and others) working in this repo. Human contributors
should read it too. Project rules also appear in [CLAUDE.md](CLAUDE.md); both must stay consistent.

## Boundaries: what you never do without a human

**Real people's data never goes in this repo.** No real athlete's race results, splits, ages, names or rankings,
including the maintainers' own, in code, tests, fixtures, docs, screenshots, commit messages or PR descriptions.
Use synthetic data only. If a task seems to need real data, stop and ask.

Publishing, releasing, and deleting are decisions for a person. Prepare them; don't do them.

## Project Overview

**HYROX Finish Time Predictor.** A responsive, static Angular web app that predicts HYROX race times split by split (8
runs, 8 stations, Roxzone) for every division: singles, doubles and relay. It includes a deterministic Insights panel
and a race Simulator page. It is hosted on GitHub Pages at https://johnpapa.github.io/hyrox-predictor/.

Versions live in `package.json` (Angular, TypeScript, Vitest, Playwright) and `.github/workflows/deploy.yml` (Node).
Don't hardcode versions in docs.

## Repository Structure

```
src/
  index.html                 CSP meta, fonts are self-hosted (no third-party requests)
  styles.scss                global theme tokens (dark "results page" look)
  app/
    app.*                    shell: header tabs (Predictor | #simulator), floating time dock
    core/                    pure TypeScript model; no Angular except predictor.store.ts
      stations.ts            the 8 stations (order matters)
      divisions.ts           divisions, load standards, weightForAthlete()
      split-tables.ts        median split tables by finish band, PRO_MULT, FIELD, floors, band helpers
      model-params.ts        prediction tuning constants (run factor, doubles, relay, height, masters)
      fallback-params.ts     fallback/conversion constants, level tables, ranges, realistic gains
      athlete.ts             AthleteProfile, defaults, migrateAthlete() (sanitises saved data), peerProfile()
      resolve.ts             input cascades → ResolvedAthlete (value + quality + source + warnings)
      predictor.ts           predictSolo(), doubles/relay combination, predict()
      insights.ts, tips.ts   deterministic Insights (gaps, realistic gains, unknowns, tips)
      explain.ts             leave-one-out "why" attribution + build/background effects
      formulas.ts            Epley, Riegel, Paul's law, Daniels VDOT
      predictor.store.ts     signals store, opt-in localStorage persistence
      *.spec.ts              Vitest: unit, realism, fuzz, review-regression tests
    components/              standalone OnPush components (form, results board, insights, simulator…)
e2e/                         Playwright specs + fixtures, static server (serve.mjs), tutorial screenshot generator
docs/                        TUTORIAL.md (+ tutorial/*.png), AI-ANALYSIS.md
RESEARCH.md                  source for every model number
```

## Tech Stack

- Angular (standalone components, signals, zoneless, new control flow `@if/@for/@let`), SCSS, TypeScript.
- Unit tests: Vitest via `@angular/build:unit-test` (`ng test`).
- End-to-end tests: Playwright, run against the **production build** served under `/hyrox-predictor/` like GitHub Pages.
- Hosting: GitHub Pages via GitHub Actions. Relative `baseHref` (`./`), hash-based view switching (`#simulator`).
- `npm` with `package-lock.json`. `.npmrc` sets `legacy-peer-deps=true` (needed for the jsdom peer tree).

## Build & Run

```bash
npm ci
npm start                  # dev server on http://localhost:4200
npm run build              # production build → dist/hyrox-predictor/browser
```

## Testing

```bash
npm test                   # Vitest: model, conversions, insights, realism personas, seeded fuzzing
npm run e2e                # builds, then Playwright on desktop + iPhone projects
npm run docs:screenshots   # regenerates docs/tutorial/*.png (Playwright "tutorial" project)
```

- The e2e server is started by Playwright (`e2e/serve.mjs`). `npx playwright install chromium` is needed once locally.
- `realism.spec.ts` checks the predictions themselves: personas, monotonic sweeps, and 500-athlete fuzzing with a seeded
  PRNG. If you change a model constant, run it with a few seeds.

## Key Patterns and Conventions

- **Deterministic model.** No AI or network calls in `core/`. See `docs/AI-ANALYSIS.md`.
- **Input cascades.** Every ability resolves measured › converted › self-rated › assumed. "Not sure" (assumed) must
  never shift a prediction, only widen the range. Insights must never invent numbers for unknown abilities.
- **Insights compare with "athletes like you"** (`peerProfile`): same build, age, experience, race times and training
  volume, typical on trainable abilities. New fixed traits belong in `peerProfile` and `PROFILE_FACTORS`; new trainable
  inputs belong in `FACTORS` (`core/explain.ts`) and must be cleared by `peerProfile`.
- **Inputs:** numbers use `app-number-input`, times use `app-time-input`. Both have −/+ steppers, arrow keys and inline
  range checks. Give every new field a `range` (from `FALLBACK.ranges`), a `step` and a `start`. Any range the UI
  shows must also be enforced in the model (`resolve.ts` `ok()` or `sanitizeRanges()`).
- **Validation UX:** format checks live in `core/validate.ts` (`checkNumber`, `timeError`). Set `integer` for counts
  and `allowZero` only where 0 is meaningful. Errors use the global `.field-error` class and `input.invalid` (red
  `--error` token, icon, `aria-invalid`, `aria-describedby`). They show on blur and clear as soon as the value is
  fixed. Any other free-text field (e.g. Simulator splits) follows the same pattern.
- **Quick vs Detailed:** Quick (`store.mode`) shows at most 10 inputs, the biggest drivers in RESEARCH.md "Quick view".
  They're the same components and units as Detailed. A new field goes in Detailed unless it outranks one of those;
  keep `QUICK_ABILITIES`, `detailOnlyInputs()` and `e2e/quick.spec.ts` in sync. E2E tests default to Detailed via the
  `formMode` fixture option.
- **Everyday inputs only:** every field must be something an average HYROX entrant could know (no niche
  benchmarks like CrossFit "Karen"). See RESEARCH.md "Only everyday inputs".
- **Every model number is sourced** in `RESEARCH.md`. Estimates are labelled as estimates.
- **The in-app "How the prediction works" section** (`components/methodology.html`) is user-facing documentation of the
  model. Update it in the same change whenever model behaviour changes.
- **Every bug fix ships with a regression test** named after the behaviour that broke.
- **Privacy.** No cookies, no third-party requests, nothing stored unless the user opts in ("Save my inputs"). The CSP
  in `src/index.html` enforces this; e2e checks it.
- **Components.** Standalone, `ChangeDetectionStrategy.OnPush`, `input()`/`output()`/`computed()`/`linkedSignal()`.
  Inputs must never rewrite what the user is typing: use `NumberInput` / `TimeInput`, never raw
  `[value]` + `parseFloat`.
- **Accessibility.** Pressed-state buttons (`aria-pressed`) instead of `role="radio"` without arrow keys; no nested
  interactive elements; labels linked to inputs with hints via `aria-describedby`.

## Adding a New Athlete Input

1. `core/athlete.ts`: add the field to `AthleteProfile` and `defaultAthlete()`, and to the `numeric` list in
   `migrateAthlete()`, which sanitises saved data.
2. `core/fallback-params.ts`: add a plausible range to `FALLBACK.ranges`, plus any conversion constants.
3. `core/resolve.ts`: use it in the relevant cascade with `ok(value, rangeKey, ability, label)`, and update `sources`
   and `quality`.
4. `core/predictor.ts` (and `model-params.ts`) if it changes a station or run directly.
5. `components/athlete-form.html/.ts`: add the input (`app-number-input`, `app-time-input` or `app-lift-input`).
6. `core/insights.ts`: add it to `realisticGains()` and `UNKNOWN_HOW` if it is a trainable or measurable ability.
7. Tests: add unit tests (`resolve.spec.ts` / `realism.spec.ts`) and an e2e test (`e2e/*.spec.ts`).
8. Docs: `RESEARCH.md` (source), `components/methodology.html`, `docs/TUTORIAL.md`, `CHANGELOG.md`.

**Adding a new ability** (a new Weak…Elite scale) also touches: the `AbilityId` union, `emptyLevels()` and
`ABILITY_IDS` in `athlete.ts`, `FALLBACK.abilityWeight`, `core/level-anchors.ts`, and `ABILITY_NAMES` / `NEXT_STEP`
in `athlete-form.ts`.

**Adding a division:** `divisions.ts` (`DIVISIONS`, rules in `weightForAthlete`, `sexIsChoosable`),
`split-tables.ts` (`FIELD`), the division list in `e2e/app.spec.ts`, and `README.md`.

## Screen Size / Responsive Rules

- Must work at iPhone width (390 px) with **no horizontal scroll**; e2e checks this on the `iphone` project.
- Layout breakpoints: `≤1023px` single column plus fixed bottom dock; `≥1024px` two columns with a sticky, scrollable
  results panel and a floating time pill when the board clock is off screen; `≤560px` compact splits table; `≤760px`
  compact simulator scoreboard.
- Inputs use a 16 px font (prevents iOS zoom); touch targets are ≥ 36–44 px.

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main`, on pull requests, and on manual dispatch. It runs: npm ci
→ unit tests → build → Playwright (desktop + iPhone) → deploy to GitHub Pages. Pull requests build and test but don't
deploy.

## Documentation

- `README.md` covers features, privacy, hosting, commands and contributing.
- `docs/TUTORIAL.md` is the screenshot walkthrough; regenerate its images with `npm run docs:screenshots`.
- `RESEARCH.md` holds the data sources and the rationale for every model constant.
- `docs/AI-ANALYSIS.md` records why the app has no AI.
- `CHANGELOG.md` uses the Keep a Changelog format.

## Common Pitfalls

- Playwright `fill()` sets the whole value at once and hides keystroke bugs. Use `pressSequentially` to test typing.
- `getByLabel` matches substrings: "Marathon" also matches "Half marathon". Use `{ exact: true }`.
- Don't put a field name in a group's `aria-label` (it breaks `getByLabel`); the unit switch uses "Weight units".
- Stacked multipliers can produce superhuman splits. Keep the personal-adjustment cap (`personalMultRange`) and the
  world-class floors (`STATION_FLOOR`), and add fuzz coverage.
- The strict CSP blocks inline scripts. Keep `inlineCritical: false` in `angular.json`.
- Doubles contributions must sum to the station time (swap time is shared); relay order is optimised over 24
  permutations.
