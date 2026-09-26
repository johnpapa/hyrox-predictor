# HYROX Predictor — contributor rules

Full agent guide: [AGENTS.md](AGENTS.md). Conventions and maintenance matrix: [.github/copilot-instructions.md](.github/copilot-instructions.md).

Angular 21 (standalone components, signals, zoneless) static app deployed to GitHub Pages.

## Rules

1. **Every bug fix ships with a regression test** that fails before the fix and passes after it.
   - Model and calculation bugs go in a Vitest spec under `src/app/core/`. Put realism and prediction-quality bugs in
     `realism.spec.ts` and review-driven fixes in `review-fixes.spec.ts`, or next to the code they cover.
   - UI and interaction bugs go in a Playwright spec under `e2e/`. Use `pressSequentially` for typing bugs; `fill()`
     hides keystroke-level problems.
   - Name the test after the behaviour that broke, so it is obvious why it exists.
2. **The prediction stays deterministic.** No AI or network calls in the model; see `docs/AI-ANALYSIS.md`.
3. **Privacy:** no cookies, no third-party requests, nothing stored unless the user opts in. The CSP in
   `src/index.html` enforces this, and the e2e suite checks it.
4. **Model constants live in `model-params.ts`, `fallback-params.ts` and `split-tables.ts`**, and every number is
   documented in `RESEARCH.md` with its source.

## Commands

```bash
npm test                 # unit + realism + fuzz tests (Vitest)
npm run e2e              # Playwright, desktop + iPhone, against the production build
npm run docs:screenshots # regenerate docs/tutorial screenshots
```

CI (`.github/workflows/deploy.yml`) runs unit tests, the build and the e2e tests before every deploy.
