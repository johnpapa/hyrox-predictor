# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Quick view** (the default for new visitors): only the 10 inputs that drive the prediction most. They're the same
  fields and units as the Detailed view, which shows everything. Values entered in Detailed keep counting and are
  listed in Quick. Saved data with details opens in Detailed.
- **− / + steppers on every number and time field.** Press and hold to repeat. Arrow keys step too (Shift × 10), and
  each field has a sensible step (e.g. 5K ±5 s, bodyweight ±0.5 kg / 1 lb, lifts ±2.5 kg / 5 lb) and starting value.
  Fields are spinbuttons for screen readers.
- **Inline validation on every field:** out-of-range entries are flagged on the field ("150 isn't realistic, so it's
  ignored (expected 16–95)"). Age, dead hang, pull-ups, burpees, unbroken wall balls and lift weights now have model
  range checks too, so the message is always true.

- **"Used for" on every input:** each field and ability card says which parts of the race it feeds.

### Changed
- **Doubles start at 50/50** on every station. Sliders stay within 20–80% (nobody does all or none of a station), and
  **Suggest a split** gives a practical 30–70% plan instead of the old automatic optimiser, which could pick 0% or
  100%. Team tactics shows which partner sets the running pace, and flags it if that pace is only assumed.

### Removed
- **Resting heart rate:** too rough to be worth entering (its VO₂max estimate is about ±10%, and it only mattered with
  no race time and no VO₂max).
- **"Runs straight after stations":** most people can't answer it reliably.

### Fixed
- **The always-visible finish time could be hidden by the iPhone keyboard.** On phones and tablets it now sits in the
  sticky top bar (the keyboard covers the bottom of the screen). Desktop keeps the floating pill. Regression test added.
- **Doubles could predict slower than your singles time with a strong partner.** The doubles Roxzone took the slower
  partner's full singles Roxzone. It now sits between the two partners (weighted 60/40 towards the slower) and
  allows for resting while your partner works. Regression test added.
- **Typing on a slow phone could rewrite the field**, e.g. "23:" jumping to "23:00" mid-entry, when the page's update
  for an earlier keystroke arrived late. Fields now ignore late echoes of values they already sent. Component
  regression tests added.

- **Doubles hand-over tips** in Insights: how often to switch on each station and each partner's share of the work.
- **VO₂max keeps a small, capped weight** even with race times (±1.5% watch, ±4% lab).

### Changed
- **Input weighting review:** self-ratings now move each station by how much it varies in real results (ergs less,
  wall balls, lunges, burpees and transitions more). Wall-ball level descriptions are relative to your running level,
  so they match the model. Experience bonuses for 3+ races and competitive athletes were reduced to race craft only.
  Details and a sensitivity table are in RESEARCH.md.

### Added
- **Working-set lifts:** enter your usual set (weight × reps) and **How hard was the set?** (to failure, 1–2, 3–4 or 5+
  reps left). Reps in reserve are added before the Epley 1RM estimate (capped at 15 reps to failure). Realistic
  strength gains are shown as working sets too.
- **Your build and background** (Insights): what bodyweight, body fat, height, age, first race, weekly running and other
  training do to your finish time.

### Changed
- **Insights compare with "athletes like you"** instead of "athletes who run like you": the comparison athlete shares
  your sex, age, height, weight, body fat, experience, race times and training volume and is typical only on trainable
  abilities, so the bars show only what training can change. Strength reasons show your estimated 1RM against the one
  assumed for athletes like you.
- "Worth measuring" asks for a squat or deadlift working set instead of a heavy test.

### Fixed
- **Strength standards were far too high** ("Solid" deadlift was 2× bodyweight, e.g. 147 kg / 330 lb for a 73.5 kg
  man). Now set for recreational HYROX athletes: Solid = 1.25× squat, 1.5× deadlift for men (0.9× / 1.1× for women).
  Level anchors also show the matching working set.
- **Weights are shown in both kg and lb** everywhere (station loads, lift sources, 1RM estimates, anchors, Insights),
  and heights in cm and ft/in.
- **Impossible body fat (e.g. 114%) was silently ignored.** Out-of-range profile and physiology entries now show a
  warning. The body fat field also says what it's doing (e.g. "+5% estimated strength") or that it has no effect once
  lifts are entered.
- The "why" breakdown could credit a below-typical squat as faster when a deadlift was also entered (the cleared squat
  was re-estimated from the deadlift). It now resets to the comparison athlete's value. Regression test added.

### Added
- AI-ready repo configuration:
  - `AGENTS.md`;
  - `.github/copilot-instructions.md` with a maintenance matrix;
  - Copilot setup steps workflow;
  - `.mcp.json` (Angular CLI and Playwright MCP servers);
  - issue forms and a PR template.
- This changelog.

### Added
- **Age-group field position:** "Top X% of Men 50–54" next to the overall position (5-year HYROX age groups), on the
  results board and the Simulator.
- **Body fat %** (optional): estimated strength uses lean mass when lifts are unknown; shown in the "why" breakdown.
- VO₂max is cross-checked against race times in the running summary.
- **Insights → "why" breakdown:** tap any station in "Vs. athletes who run like you" to see which of your inputs cause
  the difference and by how much, plus a "main reasons overall" summary. Uses leave-one-out attribution in
  `core/explain.ts`.

### Changed
- Replaced the single "training hours" input with **weekly running distance** (km or mi) and **other training hours**.
  - Running volume reduces compromised running and lap fade, with diminishing returns.
  - Other hours give a small, capped station benefit.
  - Old saves migrate automatically.

- The first-race lap penalty is now mostly explained by fitness: a small pacing allowance for everyone, plus an
  unfamiliarity part that shrinks with running volume, durable race times and regular gym/HYROX training.
- Labelled the low–high bar under the clock as **"Likely range ±X%"**, with a tooltip explaining what sets its width.
- Rewrote the in-app "How the prediction works" section to match the current model: race blend, training volume,
  first race vs. fitness, height, age, guard rails, Insights and Simulator.

### Fixed
- Removed the stale Karma "ng test" debug configuration from `.vscode/launch.json` (tests run on Vitest).

## [0.1.0] - 2026-09-26

First public release, deployed to GitHub Pages.

### Added
- **Predictor for every division:**
  - Open, Pro, Elite 15 and Adaptive;
  - Men's, Women's, Mixed and Pro doubles;
  - Men's, Women's, Mixed and Corporate relay.
- **Research-backed model:**
  - median splits from results.hyrox.com, adjusted per athlete;
  - Riegel-blended race times (5K, 10K, half marathon, marathon) with an endurance exponent;
  - erg, strength, grip, burpee and wall-ball benchmarks;
  - optional height, age and VO₂max / resting HR.
- **Fallbacks for every ability:** measured › converted › Weak…Elite self-rating › "Not sure", with a confidence range
  and a per-ability quality display.
- **Doubles:** work-split optimiser. **Relay:** leg-order optimiser.
- **Results board** styled like official results, locked splits, a race simulator animation and an estimated field
  position.
- **Insights panel:**
  - gaps against athletes who run at your pace;
  - realistic 8–12 week gains;
  - "worth measuring" for unknowns;
  - practical tips.
- **Simulator page** (`#simulator`): sliders for every split, band tags, scale-all and hit-a-target.
- **Live feedback:** each change flashes its effect on the finish time; phone dock and desktop floating time.
- **Privacy:** opt-in local storage only, self-hosted fonts, strict CSP, no cookies or third-party requests.
- **Tests:** Vitest suites (unit, realism personas, seeded fuzzing, review regressions) and Playwright e2e on desktop
  and iPhone against the production build. The screenshot tutorial is generated by Playwright.

### Fixed
- Fixes from the expert code and HYROX-data reviews:
  - Time input rewrote keystrokes ("23:30" became 2:03:30).
  - Women's Open wall balls now reflect 100 reps.
  - A relay is now faster than doubles.
  - Adaptive division weights.
  - Elite calibration against world records.
- Fixes from user testing:
  - Suggestions no longer invent strength numbers for unknown lifts.
  - Running gains are realistic for the athlete's level and age.
  - A Roxzone self-rating no longer stacks with the first-race allowance.
  - The inline kg/lb switch applies to every weight field.

[Unreleased]: https://github.com/johnpapa/hyrox-predictor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/johnpapa/hyrox-predictor/releases/tag/v0.1.0
