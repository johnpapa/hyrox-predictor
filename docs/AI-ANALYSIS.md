# Should the predictor use AI (the Claude API)?

**Status:** research only. The deterministic **Insights** panel recommended below has been built; AI features are
not planned for now.

## TL;DR

1. **Keep the prediction itself deterministic.** The finish-time model is testable (74 unit tests including realism
   and fuzz tests, 88 e2e runs), repeatable, explainable and free. A language model should never compute or change the
   times. If AI is used, it only *explains* numbers the model already produced.
2. **Most of the "analysis" people want can be done without AI**: biggest limiters versus athletes at your running
   level, which input would help most, and what-ifs like "+15 unbroken wall balls saves about 40 s". A rule-based
   **Insights panel** gives that for free, keeps the no-data-leaves-your-device promise, and can be unit-tested.
   **Recommended next step.**
3. **If you still want an AI coach**, make it opt-in with **bring-your-own-key (BYOK)** first. That needs no server
   and costs you nothing, but only suits users who have an Anthropic API key. Move to a **small serverless proxy** only
   if you want it for everyone and accept running (and paying for) a hosted service.

## What AI could add

| Idea | Value | Could it be done without AI? |
|---|---|---|
| Plain-English race summary ("you lose most time on wall balls and the sled pull…") | Medium | **Yes**: templated text from the model's own gap analysis |
| Training priorities ("add 2 sled sessions/week…") | Medium–High | Partly: rule-based priorities from the weakest stations; AI adds nuance and phrasing |
| Race-day pacing and strategy narrative | Medium | Partly: target splits are already computed |
| Doubles/relay tactics explained | Medium | Partly: the optimiser already picks splits |
| Free-text intake ("I squat 225×5, 24-min 5K, never done burpees") → fills the form | High convenience | No: this is where an LLM genuinely helps |
| Open Q&A about HYROX | Low–Medium | No, but it risks outdated rules; needs guardrails |

## Risks and costs

- **Privacy promise.** Today nothing leaves the device. Any AI feature sends the athlete's inputs and prediction to
  Anthropic (and to your proxy, if you use one). It must be opt-in, clearly labelled, and the README and privacy text
  must change.
- **Accuracy.** Model output isn't deterministic and can state wrong HYROX rules. To mitigate:
  - pass the prediction JSON and instruct the model to quote only those numbers;
  - use structured outputs, so the UI renders fixed fields;
  - check that any number in the reply matches the model's numbers;
  - build a small eval set of personas (e.g. "a no-strength athlete must be told sleds are a limiter").
- **Keys.** An API key can never ship in a static site: anyone can read it from the JavaScript bundle and spend on
  your account. The official TypeScript SDK refuses to run in a browser unless you pass `dangerouslyAllowBrowser: true`
  (verified in `@anthropic-ai/sdk` 0.128.0), for exactly this reason.
- **Security.** In BYOK mode the user's key sits in page memory, so XSS becomes the main threat. The app's strict CSP
  helps. It would need `connect-src 'self' https://api.anthropic.com`, and the key should never be stored unless the
  user opts in.
- **Abuse and cost (proxy only).** A public endpoint needs rate limiting (per-IP), a bot check (e.g. Cloudflare
  Turnstile), a monthly spend cap in the Anthropic Console, and request-size limits.

## Architecture options

| | A. Embed key in the app | B. BYOK in the browser | C. Serverless proxy |
|---|---|---|---|
| How | Key in the JS bundle | User pastes their own key; the browser calls `api.anthropic.com` via the SDK with `dangerouslyAllowBrowser: true` (sends `anthropic-dangerous-direct-browser-access: true`, which enables CORS) | Cloudflare Worker / Azure Function / Vercel function holds the key; the app calls the proxy |
| Who can use it | Everyone (and every attacker) | Users with an Anthropic API key | Everyone |
| Your cost | Unbounded | $0 | Per request (see below) |
| Stays static on GitHub Pages | Yes | **Yes** | No (adds a backend) |
| Verdict | **Never** | **Good first step** | If AI proves valuable for all users |

## Model and cost estimate (per analysis)

A typical request is the prediction JSON plus a fixed system prompt, about 2,000 input tokens and 700 output tokens.
Prices are the Anthropic first-party rates, per million tokens.

| Model | Price (in / out) | ≈ Cost per analysis | ≈ 1,000 analyses |
|---|---|---|---|
| Claude Opus 5 (`claude-opus-5`) | $5 / $25 | ~$0.03 | ~$28 |
| Claude Sonnet 5 (`claude-sonnet-5`) | $2 / $10 | ~$0.011 | ~$11 |
| Claude Haiku 4.5 (`claude-haiku-4-5`) | $1 / $5 | ~$0.0055 | ~$5.50 |

Prompt caching of the fixed system prompt lowers the input share further. Opus 5 gives the best coaching quality.
Sonnet 5 and Haiku 4.5 trade some quality for lower cost and latency. Which model to use is a product decision; it
matters most for the proxy option, where you pay.

## Recommendation

1. **Now:** build a deterministic **Insights** panel. It shows:
   - top 3 limiters versus athletes at your running level, and top strengths;
   - "fastest time savings" what-ifs, computed by re-running the model with one input improved;
   - which input would narrow the range (this already exists).

   No cost, no privacy change, fully testable.
2. **Optional, later:** an opt-in **"AI coach"** tab using BYOK:
   - it sends only the prediction JSON (not the name);
   - the reply is a fixed structured shape (summary, limiters, training priorities, race-day pacing);
   - quoted numbers are checked against the model before display;
   - there is a consent notice and the key is kept in memory by default.
3. **Only if (2) proves popular:** add a Cloudflare Worker proxy with rate limits, a bot check and a spend cap, and
   publish a short privacy notice.

## Sources

- Claude API documentation (models, pricing, structured outputs via `output_config.format` / `messages.parse`,
  prompt caching).
- `@anthropic-ai/sdk` 0.128.0 source: `dangerouslyAllowBrowser` option and the
  `anthropic-dangerous-direct-browser-access` header.
