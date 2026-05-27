# Team cheat sheet — FIRE demo & Q&A

**FIRE** = Framework for Interactive Recommender Explanations. Research web app: group restaurant recommendations (5 people × 10 restaurants), three aggregation strategies, multiple explanation UIs, optional AI chat.

---

## Run the demo locally

Prerequisites: **Node.js**, **pnpm**, **PostgreSQL** connection string (Neon-compatible serverless driver), **Google reCAPTCHA** keys, and LLM credentials if you demo **conversational** chat.

```bash
cd interactive-group-explanations
pnpm install -- alternatively, delete pnpm-lock.yaml and run npm install
pnpm dev -- alternatevily: npm run dev
```

Open **http://localhost:3000**. Production: `pnpm build` then `pnpm start`.

**Admin / preview** (password in env — see below):

- `/admin` — login -> with password `test`
- `/admin/preview` — try all explanation styles and scenarios (gear sidebar)
- `/admin/sessions` — session listing (after login)

---

## Environment variables (at a glance)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | PostgreSQL (`postgresql://` or `postgres://`); required for sessions API |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Client-side reCAPTCHA (Welcome screen) |
| `RECAPTCHA_SECRET_KEY` | Server verifies token on `POST /api/experiment/session` |
| `NEXT_PUBLIC_PROLIFIC_REDIRECT_URL` | “Completion” redirect after successful study |
| `NEXT_PUBLIC_PROLIFIC_CANCEL_URL` | Withdrawal / early cancel |
| `NEXT_PUBLIC_PROLIFIC_FAILED_ATTENTION_CHECK_CODE` | Failed attention checks (full URL; override `cc` via `FAILED_ATTENTION_CHECK_CC` or `cc` query param) |
| `LLM_PROVIDER` | `cerebras` (default), `scaleway`, or `requesty` |
| `LLM_MODEL` | Model id passed to the chat route |
| `LLM_API_KEY`, `LLM_BASE_URL` | Required for Scaleway/Requesty; defaults exist for base URLs |
| `REQUESTY_MODEL` | Default model id when provider is Requesty and `LLM_MODEL` is empty |
| `ADMIN_PASSWORD` or `ADMIN_PASSWORD_B64` | Admin login |
| `NEXT_PUBLIC_DEBUG_MODE` | Set to `true` to surface debug UI (if used in code) |

For **Cerebras** (default), set the API key the **`@ai-sdk/cerebras`** package expects (check current provider docs; often `CEREBRAS_API_KEY`).

Fuller notes live in the repo **`README.md`** — do not commit real secrets; use **`.env.local`** only on each machine.

---

## Architecture (how to explain it in one minute)

- **Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 4, Radix UI, D3 for charts.
- **Entry:** `src/app/page.tsx` → **`ExperimentFlow`** orchestrates screens (welcome → training → objective test → surveys → thank you).
- **Recommendation UI:** **`InteractiveGroupRecommender`** — rating matrix, scoring, explanation panel switcher.
- **Domain logic:** Strategies **LMS** (min rating per restaurant), **ADD** (sum of ratings), **APP** (approval count: ratings **greater than 3**, i.e. 4–5 on the 1–5 scale — computed in `InteractiveGroupRecommender` `groupScores`).
- **Scenarios:** Defined in **`src/lib/data/test_scenarios.ts`**; training vs test selection in **`src/lib/experiment-utils.ts`**.
- **Persistence:** **Neon serverless** driver in **`src/lib/db.ts`**. Migrations run on session create (`runMigrations()`). Main table: **`experiment_sessions`** (JSONB for tasks, timings, chat logs, etc.).
- **Experiment APIs:** under **`src/app/api/experiment/`** — e.g. session create, answer PATCH, complete.
- **Chat:** **`POST /api/chat`** — Vercel AI SDK `streamText`, **single model, no tools**. Context (ratings, scores, strategy) is injected in the prompt; not retrieved by RAG.

---

## Participant flow (for talking points)

Roughly **20–30 minutes**: Welcome (consent + reCAPTCHA) → Demographics → Instructions → **Training** (3 scenarios) → Likert “understanding” → **Objective test** (6 scenarios, includes attention checks) → repeat Likert → Debriefing → NASA-TLX → Feedback → Thank you / Prolific redirect.

Failed attention checks → **attention-fail** path and the failed-attention URL from env.

---

## Conditions & URLs

- **3 × 5 design:** aggregation (**add** / **app** / **lms**) × explanation modality (**no_expl**, **static_list**, **interactive_list**, **conversational**, **interactive_bar_chart**).
- **Random assignment:** Balanced by counts in DB when no `group` code is given.
- **Fixed condition:** `?group=CODE` — valid codes in **`src/lib/experiment-utils.ts`** (`GROUP_CODES`, e.g. `ADST`, `LMCO`).
- **Prolific:** `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID` appended by Prolific when configured.
- **Preview scenarios:** e.g. `?scenario=add1` (see **`README.md`** for patterns).

---

## FAQ — technical & setup

**Q: Where do participant answers go?**  
A: Into **PostgreSQL** via the experiment API routes, consolidated on the **`experiment_sessions`** row (plus PATCH updates as they progress).

**Q: Does the chat call external tools or a second model for counterfactuals?**  
A: **No.** One LLM, streaming text only; “what if” answers are **narrated** from the same injected context, not verified by a separate engine.

**Q: Why can’t I create a session?**  
A: Check **`DATABASE_URL`**, reCAPTCHA keys, and network to Google reCAPTCHA verify endpoint. Server logs show reCAPTCHA verification summary.

**Q: Chat returns errors in conversational condition.**  
A: Verify **`LLM_PROVIDER`** and provider keys/URLs; **`LLM_MODEL`** must match the provider. Requesty can fall back to **`REQUESTY_MODEL`**.

**Q: How is “score” defined when we speak to participants?**  
A: **Strategy-dependent:** LMS → minimum rating across the group for that restaurant; ADD → sum of ratings; APP → number of group members with rating **> 3** (equivalent to **4 or 5** on the discrete scale).

**Q: What’s the difference between the main study and `/admin/preview`?**  
A: Preview lets you switch explanation modes and scenarios freely; the live study fixes modality/strategy from assignment and follows **ExperimentFlow** steps.

**Q: Migrations?**  
A: Applied automatically when sessions are created — no separate `migrate` CLI in this repo; ensure DB user can create types/tables/alter enum.

---

## Key file map

| Area | Location |
|------|----------|
| Experiment orchestration | `src/components/experiment/ExperimentFlow.tsx` |
| Main recommender + explanations | `src/components/experiment/` + `src/components/explanation-styles/` |
| Group codes & scenario pick | `src/lib/experiment-utils.ts` |
| Scenario data | `src/lib/data/test_scenarios.ts` |
| DB schema & migrations | `src/lib/db.ts` |
| Chat streaming | `src/app/api/chat/route.ts` |
| Session / answers | `src/app/api/experiment/` |

---

## Production checklist (short)

- Set all **public** and **server** env vars on the host (Vercel, VM, etc.).
- Confirm **reCAPTCHA** domain allowlist matches deployment URL.
- Smoke-test: create session, complete one training block, one chat message if **conversational**.
- Prolific URLs point to the correct **completion / return / attention-fail** codes.

For extended documentation, use **`README.md`** in the repository root.
