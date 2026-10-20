# Submission artifacts

These files come from real Groq calls and official pages read with Scrapling. All student profiles are explicitly fictional. Conditional results do not guarantee admission or funding.

| Profile | Research report | Application draft | Workspace snapshot |
| --- | --- | --- | --- |
| Rahul: B.Tech Computer Science, 8.2/10 | [10 researched opportunities, top five](rahul-research-report.md) | [Reviewed SOP draft](rahul-application-draft.md) | [JSON](rahul-live-validation.json) |
| Meera: Communication Design → Interaction Design, Finland/Sweden/Netherlands | [10 researched opportunities, top five](adaptation-research-report.md) | [New student draft](adaptation-application-draft.md) | [Validation and snapshot](adaptation-validation.json) |
| Aisha: Economics, Germany/Netherlands | [11 researched opportunities, top five](alternate-research-report.md) | [Reviewed motivation letter](alternate-application-draft.md) | [JSON](alternate-live-validation.json) |

The snapshots retain actual run history, including earlier partial runs and recovery attempts. Use the final report and current structured opportunities for the checked findings. Unknown source requirements and missing student information remain visible.

## Five-minute demonstration

[Watch the screen recording](tetranoodle-5-minute-demo.webm).

The recording combines a fresh live conversational reply with previously completed live research workspaces. It is recorded in real time, with on-screen captions and no audio. It does not claim that the earlier research completed in five minutes. It shows the team, documents, sequential handoffs, tool activity, recommendations, eligibility gaps, source excerpts, comparison, a draft, adaptation to the economics profile and phone layout.

[Recording metadata and scene guide](demo-recording.json).

Nothing was submitted to a university or scholarship provider. No API keys, private workspace storage or original student data are included.

## New student workflow

[Live profile demo guide](../docs/live-profile-demo.md). The design student was supplied as a new text profile through the same creation API used by the website. Its queries, eligibility decisions, source-backed opportunities and draft were generated from that input. General development retries and validation-pass digests are retained in the validation file. Missing funding and admission information remain explicitly unresolved.

[Student switcher](ui-student-switcher.png) · [New student form](ui-new-student.png) · [Phone form](ui-new-student-phone.png) · [New student's actual matches](ui-adapted-matches.png).
