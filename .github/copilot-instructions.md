# Copilot instructions: HYROX Finish Time Predictor

Read [AGENTS.md](../AGENTS.md) first for structure, commands and patterns. This file holds conventions and the
**maintenance matrix**.

## TypeScript / Angular conventions

- Standalone components only, `changeDetection: ChangeDetectionStrategy.OnPush`, signals everywhere (`signal`,
  `computed`, `linkedSignal`, `input()`, `output()`, `viewChild()`). There is no zone.js; don't rely on it.
- Templates use the built-in control flow (`@if`, `@for` with `track`, `@let`). No `*ngIf` / `*ngFor`.
- Keep `src/app/core/` framework-free (pure functions and types), except `predictor.store.ts`. The model must stay
  unit-testable without TestBed.
- Single quotes, 2-space indent, print width 100 (`.prettierrc`, `.editorconfig`). The split tables in
  `split-tables.ts` are hand-aligned; don't reformat them.
- Units: store kilograms and seconds internally; convert only at the UI edge (`LB_PER_KG`, `formatTime`/`parseTime`).

## Conventions from code reviews

These come from the expert reviews recorded in `CHANGELOG.md` and `RESEARCH.md`, which served in place of PR history.

- **Never rewrite user input while typing.** Use `app-number-input`, `app-time-input` or `app-lift-input`. They use
  `linkedSignal` and keep the typed text. Bug example: "23:30" became 2:03:30.
- **Validate everything that crosses a boundary:** saved `localStorage` data goes through `migrateAthlete()` and
  `sanitize()`, and implausible inputs are ignored with a visible warning (`FALLBACK.ranges`, `ok()` in `resolve.ts`).
- **No double counting.** A self-rating that describes behaviour (e.g. transitions) replaces the related allowance
  (experience) instead of stacking with it. Sled ratings adjust technique only, not strength.
- **"Not sure" is neutral.** Level 3 ("Solid") equals the typical athlete; assumed values never move the prediction and
  never appear as concrete suggestions.
- **Suggestions must be realistic.** Gains are sized by level and age (`FALLBACK.realisticGains`) and quote what the
  user actually entered.
- **Every bug fix includes a regression test**, labelled `REGRESSION:` where it guards a reported bug.
- **Accessibility:** use `aria-pressed` toggle buttons instead of `role="radio"` without arrow keys; no nested
  interactive elements; move focus into dynamically inserted editors; keep live regions small.

## Test conventions

- Model tests are Vitest specs next to the code in `src/app/core/*.spec.ts`:
  - `predictor.spec.ts` / `resolve.spec.ts`: units and cascades;
  - `realism.spec.ts`: personas, cause-and-effect sweeps, seeded fuzzing (human limits per split);
  - `review-fixes.spec.ts`: review regressions;
  - `insights.spec.ts`: the Insights panel;
  - `weighting.spec.ts`: how much each input moves the prediction relative to the others (update with RESEARCH.md
    "Input weighting review" when weights change).
- E2E tests are Playwright specs in `e2e/*.spec.ts`, using the `app` auto-fixture in `e2e/fixtures.ts`. Tests run on
  the `desktop` and `iphone` projects against the production build. Use `pressSequentially` for typing,
  `{ exact: true }` for ambiguous labels, and `isMobile` for layout-specific assertions.
- Screenshots in `docs/tutorial/` come from `e2e/tutorial.ts` (`npm run docs:screenshots`). Regenerate them after
  visible UI changes.

## Asset / content rules

- Fonts are self-hosted via `@fontsource/*` (listed in `angular.json` styles). Never add CDN links: the CSP blocks them.
- The HYROX name is used descriptively. Don't add official logos; keep the "unofficial fan-made tool" disclaimer.

## Maintenance matrix

| When you change… | Also update… |
|---|---|
| A model constant or model behaviour (`model-params.ts`, `fallback-params.ts`, `split-tables.ts`, `predictor.ts`, `resolve.ts`) | `RESEARCH.md` (source/rationale); **the in-app "How the prediction works" section (`components/methodology.html`)**, which must always describe the current model; run `realism.spec.ts` with several seeds; `CHANGELOG.md` |
| `AthleteProfile` (`athlete.ts`) | `defaultAthlete()`, the `numeric` list in `migrateAthlete()`, `FALLBACK.ranges`, `resolve.ts` cascade/`sources`/`quality`, `athlete-form.html/.ts`, `insights.ts` (`realisticGains`/`UNKNOWN_HOW`), tests, `components/methodology.html`, `docs/TUTORIAL.md` |
| A new ability (`AbilityId`) | `emptyLevels()`, `ABILITY_IDS`, `FALLBACK.abilityWeight`, `level-anchors.ts`, `ABILITY_NAMES`/`NEXT_STEP` in `athlete-form.ts`, `resolve.ts` `quality`/`sources` |
| Divisions or loads (`divisions.ts`) | `weightForAthlete()`, `sexIsChoosable()`, `FIELD` in `split-tables.ts`, the division list in `e2e/app.spec.ts`, `README.md`, `RESEARCH.md` |
| Stations (`stations.ts`) | `STANDARDS`, split-table columns, `STATION_FLOOR`, `PRO_MULT`, doubles `intensityFloor`/`swapSec`, `tips.ts`, realism `LIMITS` |
| `predict()` output shape (`Prediction`, `SoloPrediction`) | `results-board`, `insights-panel`, `simulator-page`, `insights.ts`, e2e fixtures |
| Visible UI | Playwright specs, `npm run docs:screenshots`, `docs/TUTORIAL.md`, README screenshots |
| Storage / privacy (`predictor.store.ts`) | `sanitize()`, e2e "stores nothing / opt-in save" tests, README Privacy section |
| `src/index.html` CSP or fonts | e2e "no third-party requests" test, `angular.json` styles |
| Hosting (`angular.json` `baseHref`, `deploy.yml`) | `e2e/serve.mjs` (sub-path), README Hosting section |
| Any user-visible change | `CHANGELOG.md` under `[Unreleased]` |
