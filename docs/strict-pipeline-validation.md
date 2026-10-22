# Strict pipeline — implementation and validation, 22 October 2026

The forward-only pipeline is implemented and both live profiles completed the workflow. **Research delivery remains partial.** Rahul produced five conditional recommendations; Arts/Germany produced two. Neither run established all four source fields across five recommendations. The live report deliberately does not claim full hackathon completion.

## Before and after

| Concern | Before | Current behavior and evidence |
| --- | --- | --- |
| Phase order | Discovery, detail verification and completion could reopen earlier work. | Persisted `profile → discovery → eligibility → rank → draft → summary` cursor in `orderedPipeline`, `server/pipeline-state.js`. Both live logs follow this sequence. |
| Arjun | Profile helpers could run again after extraction. | `enrichProfile` respects `profileReviewed`; required intake is gated before discovery, including legacy checkpoints. New documents/profile revisions invalidate derived state. |
| Nova | Coverage gaps could trigger widening after ranking. | `discover` stops at ten URL-backed leads. Only dead/clearly ineligible candidates allow one shortfall round before Sage finishes. Missing evidence alone does not trigger discovery. |
| Sage | Long source/model waits could consume the whole pass. | Official-source resolution and full-page fetching retained. Each candidate has 45 seconds total and at most two persisted targeted retries per missing field. Optional supporting-page fetches have five-second limits. |
| Verification ownership | Nova performed detail searches; Mira performed source criticism during other stages. | Sage owns same-opportunity searches, extraction and independent critic checks. Large extraction reuses `GROQ_DETAIL_MODEL` (default GPT-OSS 120B), retaining Sage's own key; ownership and critic calls keep the role model. |
| Ranking and drafting | Repeated verification could rerank or redraft. | Mira ranks once. Leo attempts one selected draft and checks it himself; a budget-constrained fallback is explicitly a profile scaffold. No web tool belongs to Leo. |
| Completion and recovery | Repeated interruption messages and reopened work. | One Complete/Partial final message. Once-only lifecycle and phase events. Completed Resume is a no-op. A user can explicitly start a fresh run from Matches. |
| Budgets/checkpoints | Work could continue after the useful result or resume with renewed allowances. | Eight-minute total active budget, 100 logical calls, cumulative candidate receipts. Manual pause retains progress. An interrupted process conservatively counts elapsed wall time rather than granting fresh budgets. |
| Chat compatibility | Broad job guards could interfere with a separate chat turn. | Scope guards use the job-bound emitter, preserving explicit chat document access; regression tested in `tests/tools.test.js`. |
| UI | Count fractions and active-looking verification labels could persist. | Found counts use “N found (10 required)”; completed partial evidence is Not confirmed/Unverified. No automatic Resume or verification action on a closed run. Existing chat, documents, matches, applications and theme features remain. |

The existing provider fallback order, checkpoint file format/storage, failure injection and SSE transport were reused. The unused legacy `verify-shortlist.js` utility remains for its existing callers/tests; it is not imported by the current research coordinator and its missing-field replacement policy does not control runs.

## Actual unmocked results

Sources: [machine-readable live report](../artifacts/strict-pipeline-validation.json) and [actual phase event log](../artifacts/strict-pipeline-event-log.txt). Both cases used real browser form entry, document upload, API calls, configured providers and fetched public sources. All writes used temporary isolated student storage, deleted after testing. No real student workspace or `.env` was changed.

| Profile | Found / checked | Recommendations | Fully verified | Draft | Time | Logical calls |
| --- | --- | --- | --- | --- | --- | --- |
| Rahul, final-year B.Tech CS → master's CS/AI | 10 / 10 | 5 conditional | 0 | Labeled profile scaffold | 6m 40s | 100 / 100 |
| Fictional Ananya, final-year BFA → master's Fine/Visual Arts, Germany | 11 / 11 | 2 conditional | 0 | AI-reviewed draft | 5m 25s | 84 / 100 |

Actual event order:

```text
Rahul: Arjun profile done → Nova discovery done (10) → Sage eligibility done (10)
       → Mira ranked 5 → Leo saved one scaffold → Mira one Partial summary

Arts/Germany: Arjun profile done → Nova discovery done (10)
       → Sage eligibility done (11, after ONE shortfall round for a sourced mismatch)
       → Mira ranked 2 → Leo saved one AI-reviewed draft → Mira one Partial summary
```

Every structural check passed: ordered milestones, one started/finished event per agent, role scope, no calls after done except the explicitly permitted Nova repair, at most two field retries, bounded candidate/run times, one final summary, no widening/interrupted chat messages, and no-op Resume after completion. The real-data browser opened Matches, Documents, Applications and chat without page errors. Arts/Germany did **not** meet the five-recommendation delivery target; that false check remains in the report.

Observed external limitations: Sage reached the GPT-OSS 20B **daily token allowance**, and GPT-OSS 120B/Qwen **minute token allowances**, all on `GROQ_API_KEY_SAGE`. The existing fallback/backoff recovered, but several candidate windows expired. Some official pages also returned HTTP 503; some aggregator/portal pages did not establish a specific official opportunity. These remain partial, not invented replacements. Rahul stopped at the tool budget and saved a scaffold; the Arts run exhausted its bounded candidate checks and single permitted repair. Neither run silently continued after its final summary.

The earlier isolated diagnostic returned three Rahul recommendations in 7m20s before heavy extraction was routed through the existing detail model. Its report is [diagnostic only](../artifacts/strict-pipeline-before-model-routing.json). The still older 2/5 verification result used a different, longer research policy; it is not directly comparable to these strict 45-second/100-call runs.

## Automated checks

- 118 backend tests pass, including 13 focused pipeline tests plus model-routing, concurrent chat access, source trust, parsing/OCR, fallback, verification, draft safety and persistence coverage.
- 43 browser tests pass, including the light-on-reload landing, always-moving visible background, profile intake, sources, documents, matches, drafts, themes, student management and new explicit fresh-run behavior. The terminal evidence-label refinement also received a targeted workspace-suite rerun.
- Typed contracts, production build and `git diff --check` pass. The existing Three.js chunk-size advisory remains.
- Logs: `/tmp/scholarx-resume-backend.log`, `/tmp/scholarx-resume-ui.log`, `/tmp/scholarx-resume-workspace-final.log`, `/tmp/scholarx-resume-types.log`, `/tmp/scholarx-resume-build.log`.

Reproduce after `npm run build`: `node scripts/check-pipeline.mjs` (or `--case=rahul` / `--case=arts-germany`). Each case permits eight minutes; this is a real provider test. The script distinguishes workflow checks, delivery targets and full evidence completion. Exit 0 means complete research, 2 means a correctly handled partial outcome, and 1 means a workflow/validation error. Inspect `checks`, `phaseLog`, `candidateChecks`, `toolLog` and `quotaEvents` rather than assuming a successful workflow means verified scholarship eligibility.

## Files changed for the strict-pipeline task

- Coordinator and integration: `server/pipeline-state.js` (new), `server/research.js`, `server/research-details.js`, `server/research-quality.js`, `server/groq.js`, `server/tools.js`, `server/store.js`, `server/agents.js`, `server/profile.js`.
- Existing workspace UI: `src/App.jsx`, `src/Matches.jsx`.
- Validation: `tests/pipeline-order.test.js` (new), `tests/profile.test.js`, `tests/tools.test.js`, `tests/verification-flow.test.js`, `tests/browser/workspace.spec.js`, `scripts/check-pipeline.mjs` (new), `fixtures/arts-germany-profile.json` (new), and the three strict-pipeline reports in `artifacts/`.
- Configuration/documentation: `.env.example`, `README.md`, `docs/architecture.md`, `docs/requirements-audit.md`, this report and `docs/RESUME_CHECKPOINT.md`.

These files contain pre-existing changes as well. No reset/recreation, commit or push was performed. The earlier landing light-default and animation-button removal were preserved.

## Short demonstrations

1. In the live report, show either case's six-entry `phaseLog` and once-only `lifecycle` (under 30 seconds).
2. Show Rahul's tool count 100, Partial status, scaffold method and single final milestone; contrast with the Arts input/queries and one bounded repair (under 30 seconds).
3. In a saved finished workspace, open View matches: no Resume or Verify missing details action reopens the run. Start new research is an explicit fresh-run action (under 30 seconds).
4. Reload `/`: light landing. Launch `/app`: preserved workspace appearance, moving background without the animation pause button. Chat/Documents/Matches/Applications remain accessible (under 30 seconds).

Live-test workspaces were deleted as promised; inspect retained reports for those exact results. A new full live run takes minutes and is not presented as an instant demonstration.
