# Leo SOP generation — 22 October 2026

Only SOP generation, source-footnote rendering and the requested grade-scale comparison changed. Existing research/discovery, rankings, budgets, credentials and stored source pages remain intact. `server/integrity.js` is unchanged; its unsupported-eligibility/conversion/achievement guards still pass the existing tests. The draft-only UI banner and the Supported student facts / Opportunity evidence for your review sections remain.

## What changed

| Request | Implementation |
| --- | --- |
| Use student facts and verified official facts | `server/sop-sources.js:sopCatalog` accepts profile fields, matched uploaded-document facts, exact transcript score mentions and actual stored GitHub repo/language/README metadata. Official sentences require independently verified claims and a matching fetched quotation; ambiguous/Unverified claims cannot enter SOP prose. |
| Real draft, with sentence sources | `server/research.js:generateDraft` makes one Leo call selecting approved sentence IDs across introduction, academics, projects, interests/goals, programme fit and closing. `plannedSop`/`sourceDraft` assemble prose and short footnotes from those exact facts. A model cannot authorize new prose by inventing an ID or attaching a known URL. |
| Preserve claim guard | `validateDraft` still fails closed, now checking complete approved source-backed sentences instead of comparing an entire narrative paragraph with a handful of fixed phrases. Arbitrary achievements, numbers, faculty, labs and grade equivalence remain blocked. The original `guardDraft` function is not edited; supported document coursework is explicitly allowed by the source catalog. |
| Fewer placeholders | `validateDraft` collapses unsupported material into section-level conditional prompts and one final Gaps to complete list. No repeated generic Missing lines or empty Draft section headings. |
| Other English draft entry points | `createDraft` fallback and the ordinary-chat `save_application_draft` tool reuse the same source-backed sentences, without introducing extra searches or model calls. Budget fallback stays honestly labelled as not newly AI-reviewed. Existing language-template behavior is unchanged. |
| Functional footnotes | `src/ui.jsx:Markdown` preserves internal footnote IDs/attributes and keeps fragment links in the current document. External source links retain their existing behavior. |
| Grade scales | `server/grade-comparison.js:gradeComparison` forces an unknown comparison and **Needs conversion check** when scales differ (including decimal /4.0) or the original scale is missing. `validateReview` applies it before eligibility. Matches displays it on existing saved criteria without rewriting the saved pack; the SOP gaps list includes it too. No numerical conversion or pass/fail guess. |

## Live current-profile result

Accepted redacted report: `artifacts/current-sop-validation.json`.

- Re-ran **only Leo** using the saved current profile and independently reviewed McGill Computer Science (M.Sc.) opportunity. No new discovery, GitHub crawl, profile edit, source fetch or pipeline restart.
- Generic `Missing: add a supported statement here`: **17 before → 0 after**.
- Draft narrative: **278 words**, with form, transcript, GitHub and verified official source footnotes. One conditional programme-feature prompt and one Gaps to complete list remain for genuinely unprovided information.
- Isolated real API generation completed in **1.68 seconds**, one Leo GPT-OSS 120B call, **1,598 input / 266 output tokens**, no unsupported generated statements retained.
- All **17 isolated live checks passed**, including rendered source footnotes, the draft-only banner and an unchanged original workspace during validation.
- The new draft was then saved through the existing API into the user's current workspace. Profile, documents, opportunities, run and stored evidence are unchanged; only the requested draft and its associated messages/metrics/metadata were updated.
- Current saved copy: private `.data/qa/leo-current-draft.md`. Previous full student session backed up privately at `.data/recovery/before-leo-sop-20261022/current-session.json`. Personal draft content is not copied into tracked reports.
- Additional real-browser check: 33 footnote references, one Gaps heading, visible draft banner, no generic Missing lines, one Needs conversion check label, no page errors and no horizontal overflow at 390px.

## Validation

**139 backend tests, 47 browser tests, typed contracts, production build and whitespace checks pass.** New tests cover student/transcript/GitHub prose, forged citations, unsupported claims and numbers, project attribution, section gaps, original grade scales, Leo-only generation, ordinary-chat save, internal footnote navigation and legacy grade verdict display. All prior pipeline, scheduling, source trust, draft safety, profile conflict, deletion, theme and scroll checks remain in their existing suites.

Live runner (read-only copy of the workspace):
```sh
node scripts/check-current-sop.mjs --workspace=<consented workspace ID>
```

## Files changed

- `server/sop-sources.js`, `server/draft-validation.js`, `server/grade-comparison.js`, `server/research.js`, `server/tools.js`
- `src/ui.jsx`, `src/Matches.jsx`, `shared/models.d.ts`
- `tests/sop-generation.test.js`, `tests/research-delivery.test.js`, `tests/browser/enhancements.spec.js`
- `scripts/check-current-sop.mjs`, `artifacts/current-sop-validation.json`, this note and `docs/RESUME_CHECKPOINT.md`

No dependencies or API keys changed for this task. The previous Sage-key replacement remains preserved.
