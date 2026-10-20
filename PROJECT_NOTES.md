# Product decisions

- Project: Desktop/tetranoodle.
- Experience: WhatsApp-style group conversation with five distinct AI specialists.
- Provider: Groq, with five server-side role keys in an ignored `.env` file.
- Reader: user-selected Scrapling; text-PDF extraction uses pypdf.
- Ordinary conversation: one relevant speaker and one focused question per turn.
- Complete research: Arjun → Nova → Sage → Leo → Mira, with shared source-backed artifacts.
- A known student fact, an official requirement and an interpretation of eligibility remain separate.
- Funding and admission are checked separately. Missing information stays unknown.
- Scores express research priority, never probability of admission or funding.
- Research target: at least ten distinct opportunities, five non-excluded recommendations and one draft.
- No real applications are submitted. The demo is local and uses fictional student information.

# Experiments retained in the implementation

Early role prompts produced repeated introductions and too many questions. A coordinator now selects a single public speaker; all specialists contribute in sequence during research. The server appends the focused question rather than relying only on conversational timing.

Discovery and verification are separate. Actual search receipts establish candidate URLs; Scrapling retrieves official pages. Retained excerpts must exist in those pages, including every retained fragment of an excerpt with omissions. A second review checks whether an excerpt supports the claim in meaning. Explicit calendar dates override a model’s mistaken open/expired classification.

The final draft also receives an independent factual review. Unsupported coursework, achievements, degree completion, grade conversions and claims of satisfying admission requirements become placeholders. Exact original grades and language scores may be stated without certifying their equivalence.

# Validation

Automated checks cover provenance, ranking, distinct program identity, date handling, draft guards, private-network rejection, persistence and responsive conversation behavior. Actual live runs use Rahul’s fictional text PDFs and a separate economics/public-policy profile. The generated reports in `artifacts/` record actual returned results and unresolved gaps.

See `docs/experiment-and-challenge.md` for the submission note.
