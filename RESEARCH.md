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
| Running | blend of 5K / 10K / half / marathon › VO₂max › level | Riegel T₂ = T₁(D₂/D₁)^1.06 (1.07 for mile/half); Daniels VDOT; Cooper VO₂ = (m − 504.9)/44.73; watch VO₂max − 4 |
| Ergs | 1k › 2k › 500 m › 5k › other erg › level | Paul's law +5 s/500 m per doubling; SkiErg ≈ row + 20 s/1k (men), +15 s (women) |
| Leg strength | back squat › front squat › deadlift › trap bar › RDL › leg press › bench › level | Epley 1RM = w(1 + r/30), ≤12 reps; front = 0.85 × back; squat = 0.8 × DL; leg press × 0.6 (rough) |
| Pulling strength | deadlift › trap bar › RDL › squat › front squat › leg press › bench › level | trap bar = 1.08 × DL (JSCR 2011); RDL = 0.75 × DL; DL = 1.6 × bench (men), 2.0 × (women) |
| Grip | farmers test › dead hang / pull-ups › level | hang (s) men 20/45/75/120/180, women 12/25/50/90/150; pull-ups men 1/5/10/15/22, women 0/2/5/10/15 |
| Burpees | 80 m BBJ test › burpees in 1 min › level | men 15/20/25/30/35, women 12/17/22/27/32 |
| Wall balls | 100 for time › max unbroken › usual set size for 100 › level | unbroken 15/30/50/75/100 |
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
hyroxdatalab.com (station times).

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

## Realism guards (added with the realism test suite)

- **World-class floors per station** (Open weights, scaled up for heavier loads). For example: men's sled push 1:40,
  women's 1:30; lunges 2:15; wall balls 2:50. No prediction goes below them, however strong the inputs.
- **Combined personal adjustments are capped** at 0.65–1.5× the typical time for athletes at the same run pace
  (strength × bodyweight × skill). Entered station tests are exempt. This stops extreme inputs from stacking
  unrealistically.
- **Station baselines ignore the Pro running penalty.** Heavier sleds slow the runs but don't make an athlete a
  weaker skier or rower.

## Race distances, height, body fat and realistic gains (Sept 2026 research)

- **Which races predict HYROX?** No published study correlates road PBs directly with HYROX times. What the evidence
  supports:
  - **Physiology:** a HYROX takes 55–120 min with about 80% of the time above 80% of max heart rate (Brandt et al.
    2025, n = 11). VO₂max correlates with run time (ρ ≈ −0.73) but not with station time.
  - **10K and half marathon** best reflect that threshold-level effort. Coaches put HYROX laps at about 10K pace ×
    1.10–1.18 and half-marathon pace × 1.05–1.12.
  - **5K** is a VO₂max proxy. HyroxDataLab's calculator is built on it.
  - **Marathon** adds durability information but is noisy (long-run volume, fuelling, heat).
  - **1 mile** is too anaerobic, so it was removed. **Cooper test** was removed too.
- **How races are combined:** each race is converted to a 5K-equivalent with Riegel and blended with weights 10K 1.0,
  half 0.9, 5K 0.7, marathon 0.4. The shortest and longest race give a personal fatigue exponent k (≈1.06 durable …
  1.12+ fades), which adjusts the lap factor by (k − 1.07) × 0.35, capped at −0.02…+0.025.
- **Height:** there is no HYROX data. Rowing research links height and mass to erg power (r ≈ 0.7). Coaching claims
  conflict on wall balls. Estimated effect per 10 cm versus the sex reference (178 / 165 cm):
  - ski and row −1.5%, lunges −4%, burpee broad jumps −3%, each capped at ±8%;
  - wall balls neutral;
  - overall well under 0.5% of finish time per 10 cm.

  Height is optional. In doubles it mainly changes who should take lunges and burpee broad jumps.
- **Body fat:** ρ = +0.67 in Brandt (n = 11, unreliable), and largely redundant once a run time is known. Not
  captured.
- **Age:** once a run time is known, most of the effect is already in it. An estimated extra station and Roxzone
  penalty of 0.3% per year over 50, capped at 4%, covers recovery. HyroxDataLab reports 50–54 men about 11% slower
  than peak, mostly through fitness.
- **Realistic gains in 8–12 weeks**, used by Insights:
  - 5K: untrained 8–15%, recreational 3–6%, well trained 1–2%. Masters get about 60–75% of that (×0.7 over 50, ×0.55
    over 60).
  - Strength: novice +20–35%, intermediate +5–10%, advanced +1–3%. Masters gain similar percentages, so there is no
    age scaling.
  - Erg: about 2.5%. Wall-ball unbroken: +40% (max +12). Burpees: +3 per minute.
  - Fitness-free savings: Roxzone 1–3 min (10 s per transition ≈ 80 s); a planned wall-ball set strategy about 45 s;
    even pacing 1–3%.
- **Unknown abilities** are never given invented numbers in suggestions. Insights instead shows how much the finish
  could swing (Fair versus Strong) and recommends measuring that ability.

## Training volume: weekly running distance + other training hours

- **Why two inputs:**
  - Brandt et al. 2025 (HYROX, n = 11): *endurance* training volume correlated with finish time (ρ = −0.68), and only
    through the runs. Resistance-training volume did not correlate.
  - In running science, weekly distance predicts performance with diminishing returns: Tanda 2011 (marathon pace
    from weekly km and training pace, ±4 min).
  - Boston Marathon cohort 2025 (n = 917): more weekly distance and more cross-training sessions each linked to
    faster times.
  - Durability is proposed as a separate determinant, built by volume (Maunder 2021; Jones 2024/2025).
  - One combined "hours" number mixes these, and it confused users.
- **Weekly running (km or mi):**
  - Above the 25 km reference, the lap factor drops by 0.03 × (1 − e^(−(km − 25)/40)). That is about −0.017 at 60 km
    and −0.024 at 100 km.
  - Below 25 km there is a penalty of up to +0.02.
  - The effect is halved when a short and a long race already measure endurance.
  - Heavy volume also flattens lap-to-lap fade, by up to 30%. (Estimate.)
- **Other training hours** (gym, HYROX classes, erg or sled work): ±1% station time per hour against a 3-hour
  reference, capped at ±3% and half-strength on the ergs. It has no effect on the runs. The effect is small because
  the HYROX study found no strength-volume link. (Estimate.)
- **Unknown values are neutral:** they only widen the confidence range.
- **Migration:** an old combined "training hours" value is split as half running at about 9.5 km/h and half other
  training.

## First race vs. fitness (Sept 2026)

The often-quoted "first-timers run 25–30% slower than 5K pace" describes typical beginners, who are usually also less fit
(low running volume, low durability, weak muscular endurance). HYROX coaching attributes the pure first-race cost mainly
to pacing (going out too fast), Roxzone hesitation and never having practised running on legs tired from stations.

The model now splits the first-race lap penalty into:
- a fixed **pacing allowance** of +0.015 on the lap factor;
- an **unfamiliarity** part of up to +0.035, reduced by fitness indicators, with a combined reduction of at most 80%:
  - running volume: up to 60% at 50 km/week above the 25 km reference;
  - a durable short-plus-long race profile (Riegel k ≤ 1.07): 20%;
  - at least 4 hours a week of other training: 20%.

A fit, high-volume first-timer now pays about +0.02; a low-volume first-timer about +0.05, as before. (Estimate.)

## Age groups, body fat and VO₂max (Sept 2026)

- **Age-group field position.** HYROX ranks by 5-year age group (16–24, 25–29 … 65–69, 70+). HyroxDataLab (about 700k
  results) reports times rising about 1.5–3% per 5-year bracket after 30. At 50–54, men are about 11% and women about
  10% slower than their peak group, and the decline accelerates after 50. The division median sits near the 30–39
  groups, so the 50–54 median is about 1.09× (men) and 1.08× (women) the division median. The full table is
  `AGE_GROUP_FACTOR` in `split-tables.ts`. (Estimate from published group averages.)
- **Body fat.** It is redundant for running once race times are known. For estimated strength, lean mass matters: when
  lifts are unknown, the typical strength per kilogram is scaled by (1 − body fat) / (1 − typical body fat). Typical is
  18% for men and 25% for women. Measured lifts are unaffected. Brandt 2025 found lower body fat linked to faster
  times (ρ = +0.67, n = 11).
- **VO₂max and resting heart rate** stay fallbacks. With race times present they are shown as a cross-check, because
  race times are the more direct measure and VO₂max did not predict station time in Brandt 2025 (ρ = −0.11).

## Athletes like you, and working-set lifts (Sept 2026)

**Comparison baseline.** Insights used to compare each station with the median finisher at your lap pace. That mixed
fixed traits (a light 55-year-old is slower on sleds than an 82 kg 35-year-old at the same pace) with trainable ones,
so almost every bar looked "slower" for a light, older runner. The comparison athlete (`peerProfile` in
`core/athlete.ts`) now shares sex, age, height, bodyweight, body fat, experience, race times, VO₂max, resting HR,
weekly running and other training, and is "Not sure" on every trainable ability (lifts, ergs, station tests,
self-ratings). Fixed traits are reported separately (`profileEffects` in `core/explain.ts`) as effects on the finish
time versus an average athlete with the same race times. Muscle mass is represented through bodyweight × lean-mass
fraction (body fat) and, when entered, lifts.

**Strength standards (revised after user feedback).** An earlier version used 1.5× bodyweight squat and 2.0×
deadlift as "Solid" for men. Those match StrengthLevel.com "intermediate", but that sample is people who log their
lifts in a strength app. A user pointed out that a 150 kg (331 lb) deadlift as "Solid" for a 75 kg man is far above
what a normal gym's HYROX crowd lifts (typical working sets of 135–200 lb). The standards are now set for recreational
HYROX / functional-fitness athletes, with Solid equal to a typical mid-pack athlete:

| Level | Squat (men) | Deadlift (men) | Squat (women) | Deadlift (women) |
|---|---|---|---|---|
| Weak | 0.6× | 0.75× | 0.4× | 0.5× |
| Fair | 0.9× | 1.1× | 0.65× | 0.8× |
| **Solid (typical)** | **1.25×** | **1.5×** | **0.9×** | **1.1×** |
| Strong | 1.6× | 1.9× | 1.2× | 1.4× |
| Elite | 2.0× | 2.4× | 1.5× | 1.8× |

These are 1RMs; the anchors also show the matching working set (10 reps with 1–2 left ≈ 72% of the max). The squat
÷ deadlift ratio (≈0.83) matches the 0.8 conversion used elsewhere. Because the typical value is also the model's
reference athlete, "Not sure" predictions barely change; a measured lift is now compared against a realistic peer.
Strength is scaled by lean mass (body fat) but not by age: the station model already has a masters allowance from 50.
These values are estimates from general strength norms, not HYROX-specific data, which doesn't exist publicly.

**Working sets and reps in reserve.** Most recreational lifters never test a 1RM. Reps in reserve (RIR) is a validated
way to rate a submaximal set: trained lifters predict their RIR within about one rep, and accuracy is best close to
failure (Zourdos et al. 2016; Helms et al. 2016; Halperin et al. 2022 meta-analysis). Estimated 1RM =
weight × (1 + (reps + RIR) / 30) (Epley, with reps to failure = reps + RIR). The choices map to RIR 0, 1.5, 3.5 and
5.5; the default "1–2 left" matches typical hypertrophy-style sets of 3 × 8–12. Rep-based estimates lose accuracy
beyond about 10 reps to failure (LeSuer et al. 1997; Reynolds et al. 2006), so the total is capped at 15. Isolation
lifts like biceps curls are not used: they don't predict sled, carry or lunge performance.

## Input weighting review (Sept 2026)

An expert pass over every input: how much does each one move the prediction, and does that match how much it matters
in a real race? Sweep for a typical man (23:00 5K, 82 kg, 35, 1–2 races; ≈ 89 min), each input set to a realistic
"worse" and "better" value (seconds on the finish time):

| Input (worse vs better) | Effect | Verdict |
|---|---|---|
| 5K 26:00 vs 20:00 | 28:54 | Running dominates HYROX (8 km of running plus pacing between stations). Correct. |
| Marathon 4:15 vs 3:20 (with a 5K) | 13:47 | Durability over ~90 min matters; the pair is unusually inconsistent, so the effect is large. OK. |
| Experience: first vs 3+ races | 6:26 (was 8:20) | Reduced: see below. |
| Squat Fair vs Strong | 3:00 | Drives both sleds and lunges. OK. |
| Bodyweight 95 vs 70 kg (same 5K) | −2:58 | Heavier is stronger on sleds at the same run pace. OK. |
| Weekly running 10 vs 60 km | 2:41 | OK. |
| Wall balls 15 vs 50 unbroken | 2:37 | The most variable station. OK. |
| Deadlift Fair vs Strong | 2:12 | OK. |
| Compromised runs never vs weekly | 2:00 | Added, then removed (see "Inputs removed" below). |
| Body fat 28 vs 12% (strength unknown) | 1:51 | Only while strength is estimated. OK. |
| Other training 1 vs 7 h | 1:37 | OK. |
| Age 60 vs 35 (same race times) | 1:20 | Race times already carry age; this is only recovery. OK. |
| Transitions Fair vs Strong | 1:20 (was 0:59) | Increased. |
| Wall balls Fair vs Strong | 1:10 (was 0:52) | Increased. |
| Height 168 vs 190 cm | 1:07 | Small, real (ergs, BBJ, lunges). OK. |
| Burpees Fair vs Strong | 1:02 (was 0:42) | Increased. |
| Lunges Fair vs Strong | 0:55 (was 0:41) | Increased. |
| Erg Fair vs Strong | 0:36 (was 1:12) | Reduced. |
| Grip Fair vs Strong | 0:37 | Grip rarely limits Open athletes. OK. |
| VO₂max, resting HR (with a race time) | 0 | VO₂max later got a small weight; resting HR was removed. |

**Rating spread per station.** Every self-rating used the same multiplier (Weak +16% … Elite −12%). The split tables
show stations separate athletes very differently. The ratio of the slowest to the fastest band's median is: ergs
×1.21–1.28, sled push ×1.66, farmers ×1.72, sled pull ×2.0, lunges ×2.26, wall balls ×2.23, BBJ ×2.59, Roxzone ×2.22
(men; women similar). Each rating's spread is now scaled by ln(ratio) ÷ the station average: ergs 0.5, sleds and grip
1.0, lunges, wall balls and transitions 1.35, burpees 1.5 (`FALLBACK.levelSpread`). The combined skill floor moved
from 0.90 to 0.86 so Elite ratings can take effect, still above world-class floors.

**Wall-ball anchors.** The Weak…Elite descriptions said 15/30/50/75/100 unbroken for everyone. But the model compares
unbroken sets with the typical set for your running level (≈ 36 for an 89-minute finisher), so "Solid ≈ 50" was
scored like Elite. Anchors are now relative to your level and derived from the same formula, so rating a level and
entering its count give the same wall-ball time (regression test).

**Experience.** Repeat racers improve a lot between races, but most of that is training, which the fitness inputs
already capture. At the same fitness, race craft is worth less. First race vs 1–2 races stays about +5% (+3% for a
high-volume runner). 3+ races is now about −1.5% (was −3.6%) and competitive about −4% (was −6%).

**Missing inputs considered.**
- **Added, later removed:** compromised-running practice (how often you run straight after station work). It is the specific skill
  behind the gap between 5K pace and HYROX laps. Weekly practice gives −1.2% on the run factor and offsets 40% of the
  first-race "unfamiliar" penalty. "Rarely or never" gives +1%. These are estimates: brick-training studies in
  triathlon show the run-after-bike decrement shrinks with practice, and HYROX coaching treats it as the key specific
  session.
- **Not added:**
  - Previous per-station splits: high value but a long form. The previous total already calibrates the prediction.
  - Venue / sled surface: large effect, but athletes rarely know it before race day.
  - Lactate threshold and heart-rate zones: race times already measure this.
  - Isolation lifts (e.g. curls): don't predict any station.

**VO₂max and resting HR with race times.** VO₂max used to be a cross-check only when a race time existed. Race
performance = VO₂max × running economy × fractional utilisation (Joyner & Coyle 2008), so a race already contains
VO₂max. But a VO₂max that is out of line with the races often means the races are old or weren't all-out efforts. It
now gets a small say in log-time space: weight 0.08 for a watch estimate (these are largely derived from your running
already) and 0.2 for a lab test, against the races' combined weight of 1. The shift is capped at ±1.5% (watch) and ±4%
(lab). Resting HR stays unused when there's a race or VO₂max: the Uth estimate of VO₂max from resting HR has errors
of roughly ±10%, so it would add noise, not information.

**Doubles hand-over tips.** In doubles only one partner works at a time and you can switch freely, so the tips give a
switch pattern per station and each partner's share from the doubles optimiser:
- SkiErg every 100–250 m;
- row every 250 m (straps cost about 4–6 s per swap);
- sleds every 12.5 m length;
- burpee broad jumps every 10–20 m;
- farmers every 50 m;
- lunges every 12.5–25 m;
- wall balls every 10–15 reps.

These come from common HYROX doubles coaching guidance (roxlyfe, official HYROX training content). They are rules of
thumb, not measured optima.

## Inputs removed and doubles defaults (Sept 2026)

- **Resting HR removed.** It only estimated running when there was no race time and no VO₂max. Its Uth-formula VO₂max
  estimate is about ±10%, so it rarely helped, and asking for it cost every user time.
- **"Runs straight after stations" removed** (added in the input weighting review). A user pointed out that most
  athletes can't answer it reliably, and a guessed answer adds noise, not information. The experience setting and
  running volume already cover the first-race compromise.
- **Doubles default to 50/50.** The optimiser could choose 0% or 100% for a station, which no pair does. Shares now
  default to 0.5, manual shares are kept within 20–80%, and "Suggest a split" searches 30–70% in 5% steps.
- **Doubles Roxzone.** It used to be the slower partner's full singles Roxzone (including their first-race and
  slow-runner allowances), which could make doubles slower than the faster partner's singles race. Partners move
  together, so the slower one still dominates: 0.6 × slower + 0.4 × faster. Each rests while the other works: × 0.95.
- **Running pace in doubles** is still the slower partner's (both run every kilometre together), with 80% of the solo
  compromise. With a much slower-running partner, the time saved on stations is largely spent on the runs. The app now
  says so in Team tactics.

## Quick view (Sept 2026)

Quick shows only the inputs with the largest effect in the input weighting review. Sensitivity for a typical
89-minute athlete:

| Input | Effect |
|---|---|
| 5K (or a running rating when no race is known) | up to 29 min |
| HYROX experience | 6:26 |
| Leg strength rating | 3:00 |
| Bodyweight | 2:58 |
| Weekly running | 2:41 |
| Wall-ball set size for 100 reps (was max unbroken) | 2:37 |
| Pulling strength rating | 2:12 |
| Age | age group, and 1:20 from 35 to 60 |
| Sex | sets the division, loads and baselines |

That's 10 inputs, counting the running rating. Just outside the cut:
- body fat, 1:51, and only while strength is estimated;
- other training, 1:37;
- the Roxzone rating, 1:20;
- height, 1:07;
- everything else, under about 1 min each.

Lifts are rated in Quick because most people can't give a number quickly. The rating anchors show both a max and the
matching working set. Quick and Detailed edit the same fields in the same units, and hidden values keep counting.

## Field calibration from 2026 results (Sept 2026)

In a large 2026 (S9) mixed doubles field of 2,800+ teams, about 24% of teams finished under 1:19. The model's older
`FIELD` medians put 1:19 near the top third instead, so the 2026 field is slower than the data behind them. With the
same spread (σ = 0.18), the mixed doubles median becomes ≈ 90 min, a factor of 1.055. The same factor is applied to
men's and women's doubles so the three stay in their usual order. Singles are unchanged until there's a comparable
anchor.

A related lesson on self-ratings: a pair can be strong at the stations compared with the whole field and still only
typical for athletes who run as fast as they do. "Strong" in the app means stronger than athletes like you, so
rating every station Strong can make a prediction several minutes too fast. The strength anchors (× bodyweight and
working sets) help people rate themselves honestly.

Only rank and field size are used for field positions: public results sites' "top X%" labels don't always equal rank
÷ field size.

## Wall balls: usual set size (Sept 2026)

Max unbroken wall balls predicts the station well: 100 reps at race weight is muscular-endurance work, and the size
of the sets you can hold decides how many breaks you need. But most athletes have never tested a max. What they know
is how they break up 100 reps in training ("sets of 20 with short breaks"). That's also closer to race behaviour.

The set size is now the main wall-ball input in both Quick and Detailed. Max unbroken moves to the alternatives.
Conversion: sets ≈ 60% of max unbroken (athletes break well before failure so the rests stay short; a common
coaching target is roughly half to two-thirds of max). So sets of 20 ≈ 33 max unbroken, and the model then uses its
existing unbroken formula. This matches the level anchors, e.g. Solid ≈ "sets of ~20–25" for an athlete whose typical
max is ≈ 36. It's an estimate, so its quality shows as "Estimated", below a real max or a 100-rep time.

## Only everyday inputs (Sept 2026)

The app is for the average athlete, so every input should be something a typical HYROX entrant could know. "Karen"
(a CrossFit benchmark of 150 wall balls for time) was removed at a user's request. Everything left is either a common
race or gym number (5K to marathon, row or SkiErg times, squat and deadlift variants, bench, pull-ups, dead hang,
burpees per minute, watch VO₂max, body fat) or a plain-language HYROX test people do in training (100 wall balls or
sets of wall balls, 50 m sled push or pull, 80 m burpee broad jumps, 200 m farmers carry, 100 m lunges, a previous
HYROX time). New inputs should pass the same test.
