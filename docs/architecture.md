# How the agents collaborate

ScholarX has two connected paths. Ordinary chat is coordinated one turn at a time. The full research job passes explicit artifacts through all five specialists, independently of the browser connection.

```mermaid
flowchart LR
    U[Student: chat + profile + documents] --> UI[WhatsApp-style React interface]
    UI --> C[Mira: choose the next speaker\nOne focused follow-up at a time]
    C --> A[Arjun: profile + supplied public profiles]
    C --> N[Nova: discovery]
    C --> S[Sage: eligibility + ranking]
    C --> L[Leo: application writing]
    UI --> J[Start / pause / resume research]
    J --> A
    A -->|Document-supported profile\nMissing information| N
    N -->|Real search receipts\nSpecific candidate URLs| S
    S -->|10 reviewed opportunities\nFive ranked recommendations| L
    L -->|One evidence-grounded draft| C
    N --> WEB[Groq browser search\nTavily / ddgs fallback]
    S --> READ[Scrapling official-page reader\nPDF text extraction]
    READ --> E[(Full source text + excerpts\nRetrieval dates + links)]
    E --> S
    A --> G[GitHub API + supplied public URLs]
    S -->|Failed source| N
    C --> UI
    A --> P[(Private local workspace\nProfile, messages, evidence, job progress)]
    N --> P
    S --> P
    L --> P
    P -->|Resumable SSE events| UI
```

Each specialist uses its own server-side Groq API key. Mira’s planning step selects one public speaker for normal chat. That speaker answers the student and asks, at most, one focused question. Other specialists retain their distinct jobs; they do not each ask another question on the same turn.

The research job has explicit completion criteria: ten distinct researched opportunities, five recommendations that are not known to be ineligible or expired, a saved application draft, and evidence for funding, current intake/deadline, entry requirements and application instructions across the five recommendations. A deeper pass uses targeted official searches and source-selected passages, then Mira rechecks applicability and meaning. Each application step retains its own proof. It reports partial or interrupted status if these criteria are not met.

Search results are discovery leads, not evidence. Scrapling fetches actual official pages. A saved claim about funding, deadline, admission requirements or application steps must cite a verbatim excerpt from a retrieved page. Unknowns remain unknown. An excerpt match establishes provenance. Mira independently checks whether each claim is entailed by its excerpt and whether grades or missing student details have been overinterpreted. Calendar checks override incorrect past/upcoming labels. A second draft review and conservative text guards replace unsupported coursework, degree completion and self-certified eligibility with placeholders. User review remains necessary.

Job progress and extracted document text persist in the ignored `.data/` folder, with restrictive file permissions. The browser subscribes to replayable events and can reconnect after a refresh. A server restart marks active jobs interrupted, and Resume continues from saved candidates and evidence.

Groq failures retry with provider backoff. Search can change providers. An unavailable official source prompts another search. Failed or unrelated candidates are excluded, and Nova can widen discovery to replace them. No agent has a tool to submit an application.

## Adapting to a new student

The student switcher creates a new UUID workspace through the shared creation endpoint. Plain text is parsed by Arjun with matching quotes; labelled fields and canonical JSON preserve explicitly supplied facts. No original student's documents, conversation, GitHub enrichment, search receipts, eligibility decisions or draft are copied. Saved workspaces can be restored independently.

A research brief records the intended degree level, subject, explicitly supplied related interests, destinations, original grades, nationality, intake, language scores and funding needs. Discovery is constrained to this brief. Wrong study levels and opportunities outside the stated countries are excluded from recommendations. Missing essentials prompt one question rather than defaulting to a master's. A profile revision cancels the active run before its derived state is cleared, and a client workspace generation prevents delayed old replies from changing a different student's interface.

The live adaptation validation uses a communication-design student seeking interaction design in Finland, Sweden and the Netherlands. Its actual results and validation metadata are in `artifacts/adaptation-validation.json`. See `docs/live-profile-demo.md` for the demonstration steps.


Document additions and removals invalidate derived research and clear unchanged document-derived profile fields. Conflicting saved and document-supported student facts stop research for clarification. The client replaces canonical profile snapshots and ignores late results from a previous student.
