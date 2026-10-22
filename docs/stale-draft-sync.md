# Applications refresh and partial-lead display — 22 October 2026

The pasted screen contained the earlier SOP (17 generic Missing lines and a 17-passage warning). Before this fix, both the saved workspace and live API already returned the corrected source-grounded SOP with zero generic Missing lines and zero blocked claims. The Applications view refreshed metadata without refreshing draft text; a long-open page could retain the old draft after the server changed. This was a display synchronization issue, not a new scholarship-search failure.

## Minimal changes

- `server/index.js`: insights returns the readable draft and its metadata in one response. Explicit English language preparation uses the corrected `createDraft` path; other language templates retain their existing behavior.
- `src/App.jsx`: refresh draft text and metadata on Applications entry, window focus, return to a visible tab, and SSE reconnection. Reject older responses/events using their sequence cursor. Remove listeners on cleanup and keep workspace isolation.
- `src/SopOptions.jsx`: identify source-grounded prose as a draft with sentence citations; retain any genuine blocked-claim warning.
- `src/Matches.jsx`: identity-only partial leads use a cautious explanation and prefix unverified funding/date values. This prevents a legacy Guelph description from presenting Spring 2027 as a confirmed fit.
- `src/MatchDetails.jsx`: unverified dates show Deadline Unverified rather than a confirmed closing-soon countdown.
- `tests/enhancements-api.test.js`, `tests/browser/enhancements.spec.js`: cover the combined insights response, English generation, stale draft refresh, delayed responses, and unverified lead display.

The research pipeline, source excerpts, unsourced-claim guard, banner, student profile, stored draft and saved results were preserved. The live check made no provider calls and verified the original session file remained byte-for-byte unchanged. No automatic search/resume was started.

## Live results

See `artifacts/stale-draft-validation.json` for the read-only browser/API checks. The actual Applications screen displays footnotes, one Gaps to complete heading, the draft-only banner, and no obsolete 17-passage warning. It has no overflow at 390 px and no page errors. The Documents view remains accessible.

| Measure | Before display refresh | After |
| --- | --- | --- |
| Generic Missing lines in pasted earlier screen | 17 | 0 in live Applications |
| Generic Missing lines in current saved/API draft | 0 | 0 (unchanged) |
| Blocked claims in current saved/API draft | 0 | 0 (unchanged) |
| Research results | 11 found; 6 saved; 4 recommended; 0 fully verified | Unchanged; Partial |
| Legacy Guelph intake description | Implies Spring 2027 fits | Partial lead, with unverified values |

This fixes the stale SOP and misleading presentation. It does not establish Guelph's funding/intake claims, supply missing official evidence, or make the partial research complete.

## Regression verification

All 140 backend tests and 50 browser tests pass, including the existing chat, documents, matches, manual research controls, workspace isolation, themes and mobile-layout checks. Typed contracts, production build, server syntax and whitespace checks pass. Logs are `/tmp/scholarx-stale-draft-{backend,ui,types,build,live-ui}.log`. The pre-existing Three.js chunk-size advisory remains.
