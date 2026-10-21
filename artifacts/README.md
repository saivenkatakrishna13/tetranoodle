# Submission artifacts

These files come from real Groq calls and official pages read with Scrapling. All student profiles are explicitly fictional. Conditional results do not guarantee admission or funding.

| Profile | Research report | Application draft | Workspace snapshot |
| --- | --- | --- | --- |
| Rahul: B.Tech Computer Science, 8.2/10 | [Current research and shortlist](rahul-research-report.md) | [Reviewed SOP draft](rahul-application-draft.md) | [JSON](rahul-live-validation.json) |
| Meera: Communication Design → Interaction Design, Finland/Sweden/Netherlands | [Current research and shortlist](adaptation-research-report.md) | [New student draft](adaptation-application-draft.md) | [Validation and snapshot](adaptation-validation.json) |
| Aisha: Economics, Germany/Netherlands (historical run) | [11 researched opportunities, top five](alternate-research-report.md) | [Reviewed motivation letter](alternate-application-draft.md) | [JSON](alternate-live-validation.json) |

The snapshots retain actual run history, including earlier partial runs and recovery attempts. Use the final report and current structured opportunities for the checked findings. Unknown source requirements and missing student information remain visible.

## Five-minute demonstration

[Watch the screen recording](scholarx-5-minute-demo.webm).

The recording combines a real conversational reply saved before capture with actual saved live research workspaces. It is recorded in real time, with on-screen captions and no audio. It does not claim that the earlier research completed in five minutes. It shows the team, documents, sequential handoffs, tool activity, recommendations, eligibility gaps, source excerpts, comparison, a draft, the student switcher, adaptation to the design profile, light/dark appearance and phone layout.

[Recording metadata and scene guide](demo-recording.json).

Nothing was submitted to a university or scholarship provider. No API keys, private workspace storage or original student data are included.

## New student workflow

[Live profile demo guide](../docs/live-profile-demo.md). The design student was supplied as a new text profile through the same creation API used by the website. Its queries, eligibility decisions, source-backed opportunities and draft were generated from that input. General development retries and validation-pass digests are retained in the validation file. Missing funding and admission information remain explicitly unresolved.

[Student switcher](ui-student-switcher.png) · [New student form](ui-new-student.png) · [Phone form](ui-new-student-phone.png) · [New student's actual matches](ui-adapted-matches.png).

See [the current evidence audit](../docs/requirements-audit.md) for checked counts and unresolved requirements. Historical snapshots are preserved; they do not replace a fresh independent source review.

[Automated verification summary](verification-summary.json) · [Real browser validation](end-to-end-ui-validation.json) · [GitHub API recovery](github-tool-validation.json) · [Profile conflict check](profile-conflict-validation.json) · [Production runtime check](production-validation.json).

## Current interface

[Light](ui-refined-light.png) · [Dark](ui-refined-dark.png) · [Phone](ui-refined-phone.png) · [Dark phone](ui-refined-phone-dark.png) · [Research](ui-refined-matches.png) · [Application](ui-refined-application.png). These previews reflect the later visual refinement; the workflow recording above retains the earlier interface. [Validation](ui-refinement-validation.json).

## Saved-shortlist verification

[Continuation checks](continuation-validation.json) record 49 backend checks, 12 browser checks, eight unmocked website checks and the real saved-shortlist verification run. The latest fictional Rahul report and source snapshot above retain unresolved official funding, date and application gaps rather than claiming completion. Verify missing details is available from Matches; it leaves completed recommendations intact and does not restart candidate discovery.

## Profile-first screen and animated atlas

[Light desktop](profile-first-desktop.png) · [Dark desktop](profile-first-dark.png) · [Phone](profile-first-phone.png) · [Reduced motion](profile-first-reduced-motion.png). [UI validation](profile-first-ui-validation.json) · [Real manual-profile, PDF and Arjun handoff checks](profile-first-live-validation.json). The original scholarship-themed atlas uses procedural Three.js geometry and the existing ScholarX colours. Deleted demo students remain deleted; older research reports are labelled as historical in the requirements audit.
