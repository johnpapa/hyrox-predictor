# Research notes behind the model

## Divisions & loads (2025/26 rulebooks)

| Division | Sled Push (incl. sled) | Sled Pull | Farmers | Lunge bag | Wall ball / target |
|---|---|---|---|---|---|
| Open Women | 102 kg | 78 kg | 2×16 kg | 10 kg | 4 kg / 2.70 m |
| Open Men | 152 | 103 | 2×24 | 20 | 6 kg / 3.00 m |
| Pro Women | 152 | 103 | 2×24 | 20 | 6 kg / 2.70 m |
| Pro Men | 202 | 153 | 2×32 | 30 | 9 kg / 3.00 m |
| Elite 15 | Pro | | | | |

- **Doubles** use the matching Open or Pro loads. Loads are not halved. Partners run all 8 km together and split station
  work freely. **Mixed doubles** uses Men's Open loads, including the 6 kg ball, for both partners, with the wall-ball
  target by sex.
- **Relay** (Men/Women/Mixed): each of 4 athletes runs 2 × 1 km and does 2 stations, on their own sex's Open loads.
  **Corporate relay** uses Women's Open loads for everyone.
- **Adaptive:** about 13 impairment-specific divisions with modified standards. The app uses Open as a baseline.

## Split data

The median splits in `split-tables.ts` come from about 15k Open results scraped from results.hyrox.com (public datasets
`JeffG05/Hyrox-Data-Analysis` and `imterence/hyrox_analysis`, seasons 4–5), grouped by finish band. Key findings:

- Run total correlates r ≈ 0.91 with finish time (R² ≈ 0.82). Total ≈ 1.83 × run total + 8 min for Open Men.
- Running is about 48–52% of race time in Open and 45–51% in Pro. Roxzone is about 6–9%: roughly 4 min for sub-60
  finishers and 10–12 min at 120+.
- SkiErg and Row vary least between bands (about 1 min). Wall balls, burpee broad jumps and lunges vary most (about 3×).
- Run pacing: runs 2–7 are about 1.13–1.21 × Run 1. Run 8 is about 1.24–1.41 × Run 1 because it includes the finish.
- Doubles vs singles station ratio at matched run pace: ski 0.90, push 0.55, pull 0.62, BBJ 0.57, row 0.93,
  farmers 0.78, lunges 0.68, wall balls 0.66.
- Pro vs Open at matched run pace, men: push ×1.48, pull ×1.46, farmers ×1.16, lunges ×1.13, wall balls ×1.18.
  Women: push ×1.60, pull ×1.21, farmers ×1.22, lunges ×1.19, wall balls ×1.60.
- Field medians: Open Men 87.6 min, Open Women 92.0, Pro Men 82.0, Pro Women 85.6. HyroxDataLab doubles medians: Men
  79.4, Women 88.7, Mixed 85.4.

Caveat: the data is a few seasons old, and the sport has sped up by about 5–10% since. Sled surfaces vary by venue.

## Predictors

- **5K / aerobic capacity:** Brandt et al. 2025 (Frontiers in Physiology) found VO₂max was the strongest correlate of
  HYROX time (ρ = −0.71), and stronger still for the running segments. Endurance training volume also mattered. Grip and
  muscle mass did not correlate significantly in that small sample.
- **Compromised running:** coaching sources consistently put HYROX run pace 15–25% (30–60 s/km) slower than 5K pace.
- **Ergs:** race splits run at about 85–90% of fresh time-trial pace. Row station ≈ 2k split + 10–20 s/500 m.
- **Strength:** a deadlift of about 1.5–2× bodyweight makes race sleds "manageable". Below 1.2× bodyweight, athletes
  struggle.
- **Wall balls:** typical max unbroken sets are about 100+ for sub-60, about 40 at 80–90 min and about 20 at 120+.

Sources: results.hyrox.com, hyroxdatalab.com (station times, Roxzone efficiency, doubles times),
frontiersin.org/journals/physiology (10.3389/fphys.2025.1519240), roxlyfe.com, hyrox.com rulebooks, redbull.com and
puma.com weight overviews.

## Fallback predictors (when a benchmark is unknown)

Each ability resolves from the first available source. Quality (measured › estimated › self-rated › assumed) sets
the confidence range. "Not sure" equals the model's typical athlete, so it never biases the prediction.

| Ability | Cascade | Key conversion |
|---|---|---|
| Running | 5K › 10K › mile › half › Cooper › watch VO₂max › level | Riegel T₂ = T₁(D₂/D₁)^1.06 (1.07 for mile/half); Daniels VDOT; Cooper VO₂ = (m − 504.9)/44.73; watch VO₂max − 4 |
| Ergs | 1k › 2k › 500 m › 5k › other erg › level | Paul's law +5 s/500 m per doubling; SkiErg ≈ row + 20 s/1k (men), +15 s (women) |
| Leg strength | back squat › front squat › deadlift › trap bar › RDL › leg press › bench › level | Epley 1RM = w(1 + r/30), ≤12 reps; front = 0.85 × back; squat = 0.8 × DL; leg press × 0.6 (rough) |
| Pulling strength | deadlift › trap bar › RDL › squat › front squat › leg press › bench › level | trap bar = 1.08 × DL (JSCR 2011); RDL = 0.75 × DL; DL = 1.6 × bench (men), 2.0 × (women) |
| Grip | farmers test › dead hang / pull-ups › level | hang (s) men 20/45/75/120/180, women 12/25/50/90/150; pull-ups men 1/5/10/15/22, women 0/2/5/10/15 |
| Burpees | 80 m BBJ test › burpees in 1 min › level | men 15/20/25/30/35, women 12/17/22/27/32 |
| Wall balls | 100 for time › Karen × 0.62 › max unbroken › level | unbroken 15/30/50/75/100 |
| Sleds / lunges | fresh 50 m / 100 m test › strength + bodyweight model × technique level | race fatigue: sleds ×1.15, carry ×1.12, BBJ ×1.2, WB ×1.22, lunges ×1.25 (est.) |

Strength standards by level (1RM ÷ bodyweight, Weak / Fair / Solid / Strong / Elite ≈ Strength Level's Beginner /
Novice / Intermediate / Advanced / Elite):

| | Men | Women |
|---|---|---|
| Back squat | 0.75 / 1.25 / 1.5 / 2.25 / 2.75 | 0.5 / 0.75 / 1.25 / 1.5 / 2.0 |
| Deadlift | 1.0 / 1.5 / 2.0 / 2.5 / 3.0 | 0.5 / 1.0 / 1.5 / 1.75 / 2.25 |

Typical HYROX athlete (the model's reference and the "Not sure" value): squat 1.35× bodyweight for men and 1.05× for
women; deadlift 1.7× and 1.35×.

Sources: strengthlevel.com strength standards (squat, deadlift, bench, hex bar, pull-ups); strongerbyscience.com (trap
bar); Epley and Brzycki formulas; Riegel (1981); Daniels & Gilbert VDOT; Cooper test; Concept2 forum (Paul's law,
ski-vs-row); endura.coach and marathonhandbook.com (dead hang); topendsports.com (burpee tests); wodtimecalculator.com
(Karen); hyroxdatalab.com (station times).

## Corrections from the expert review (Sept 2026)

An independent review checked the model against the 2025/26–26/27 rulebooks and current data. It led to these
changes:

- **Women's Open wall balls are 100 reps** (up from 75 since 2024/25). The source data predates this, so the women's
  wall-ball column is scaled ×1.34. The Women's Pro wall-ball multiplier drops from 1.6 to 1.2.
- **Women's sled pull** is reduced 10%, because HyroxDataLab shows men and women near-identical.
- **Relay:** stations run on fresh legs (×0.83, the inverse of the race-fatigue factors), Roxzone is ×0.75, and runs
  are 1.03 / 1.08 × 5K pace. A relay is now faster than a doubles team of the same athletes, as world records show
  (45:43 vs 47:57).
- **Adaptive, mixed relay and corporate relay** use each athlete's own-sex Open weights. The 2025/26 relay rulebook
  lists only Men, Women and Mixed relay; corporate formats vary by event. Adaptive shows no field position, because its
  13 categories aren't one field.
- **Elite calibration:**
  - The extrapolated elite band is slower: push 2:20, pull 3:05, BBJ 2:45, lunges 3:00 at Open weights.
  - Stacked skill bonuses (self-level × race-craft) are capped at −10%.
  - Pacing flattens for fast runners; elites run within about 15 s/km.
  - Doubles gain less from splitting at the elite end.
  - Result: elite predictions now sit just above the world records (Pro men about 53 min vs a 51:59 record; men's
    doubles about 47 min vs 47:57).
- **Field medians:** Men's Open 89 min, Women's Open 97, Men's relay 68, Mixed relay 71, Women's relay 76.
- **Strength:** "Solid" now equals the typical athlete ("Not sure"). Women's deadlift standards are
  0.5 / 1.0 / 1.25 / 1.75 / 2.5 × bodyweight.
- **Doubles rule (2026/27):** partners must stay within 10 s of each other on the runs. This is noted in the app.
