# Experiment and technical challenge

## Experiment: making a team behave like a group conversation

Giving five models five role descriptions did not produce a useful group chat. In an early live test, multiple specialists repeated the app explanation and asked overlapping questions. Sequential network calls alone did not solve the conversational problem: the student still received several unrelated questions before answering any of them.

The revised design separates contribution from speaking. Mira plans the next conversational step and selects one relevant speaker. The app preserves a pending question topic, and appends one focused follow-up rather than allowing a reply to bundle academic score, countries, tests and budget together. During research, all five specialists contribute in a deliberate handoff: profile, discovery, verification, writing, summary. Tool progress lives in a compact activity view rather than becoming dozens of chat bubbles.

The interesting result is that a more helpful agent swarm often produces fewer public messages. Collaboration becomes visible through useful artifacts and handoffs, not simultaneous introductions.

## Challenge: trustworthy results under unreliable search and rate limits

Free web search returned broad portals, unrelated results, and temporary failures. A scholarship page could also describe an expired cycle, a PhD-only award, or an institution-wide funding policy that did not guarantee support for the student’s program.

TetraNoodle separates discovery from official-page verification. It uses real search receipts, reads source pages with Scrapling, and requires source excerpts before retaining detailed claims. It stores full source text locally but sends relevant excerpts to the agents to control context size. Funding and admission checks are separate. Matching quotes proves where a statement came from, not that every interpretation is correct; conditional eligibility and missing details remain visible.

A further live experiment exposed a more subtle failure: a perfectly matched excerpt could discuss academic excellence while the model claimed it proved full funding. Another draft converted a CGPA into an admission threshold without evidence. The final design therefore adds an independent semantic review and a draft factual review, plus deterministic guards for explicit past deadlines and self-certified eligibility. Unsupported statements become unknowns or placeholders.

The workflow is a durable job rather than one long browser request. Partial results survive page refreshes, provider rate limits and server restarts. The job retries, changes discovery paths, excludes unavailable candidates and records what remains incomplete instead of declaring success after a fixed timer.

## Demo integrity

Test students and documents are explicitly fictional. Live validation reports contain actual returned findings; the app does not seed an invented scholarship catalog. The application is a draft with placeholders, and no submission takes place. The screen recording must be described honestly if waiting periods are shortened or previously completed live findings are demonstrated.
