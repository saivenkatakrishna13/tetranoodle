# Demonstrating a different student profile

The judge can supply a new student brief without changing application code, prompts, environment variables or an opportunity list.

1. Open the chat menu and choose **Switch student**, then **New student**.
2. Paste the actual supplied brief, import a text/JSON profile, enter known fields, or attach the student's resume/transcript. Plain-text profiles use Arjun's extraction with source quotes; explicit labels and canonical JSON fields are also preserved directly.
3. Create the workspace and choose **Review my profile**. Check the current degree, intended subject and study level, country preferences, original grade scale, nationality, intake, funding constraints and language results. Missing values stay unknown.
4. Choose **Find opportunities**, **Start scholarship research**, or explicitly ask the agents to research scholarships. If the intended degree or another essential preference is missing, the team asks one focused question rather than silently assuming a master's.
5. The activity view shows the new research goal and new searches. Nova searches the intended subject and supplied related interests at the requested degree level in the selected countries. Sage rechecks official requirements against this student's facts, not a previous student's eligibility.
6. Inspect **Matches**. A wrong study level is marked as a mismatch. An opportunity outside the specified countries is excluded from recommendations, separately from academic eligibility. Missing prerequisite courses, original-grade equivalence, portfolio evidence and language components stay unresolved.
7. Open **Applications** for the new student's draft. Only the new profile and its own supported facts are provided to the writer.
8. Reopen **Switch student → Saved students** to return to the original student. Their documents and conversation are retained separately, including work entered before the switcher was introduced.

On a phone, the same controls are in the chat menu. Appearance preferences are shared across the interface, while student information is isolated by workspace.

## Inputs are data, not presets

A supported JSON example is below. This is a fictional input, not a prepared set of university answers.

```json
{
  "name": "Example student (fictional)",
  "degree": "M.Sc. Environmental Science",
  "target_degree": "PhD Climate Science",
  "countries": ["Sweden", "Finland"],
  "cgpa": "3.7 / 4.0",
  "nationality": "Indian",
  "intake": "2027 entry",
  "budget": "Needs tuition and living support",
  "interests": "Climate modelling, environmental change"
}
```

Existing canonical field names are in the profile form. Other free-form briefs are read by Arjun. Residence is not treated as nationality, a grade is not converted to another scale, and an absent GitHub or portfolio is not invented.

## Validation

```sh
npm test
npm run test:ui
node scripts/validate-adaptation.mjs --profile=fixtures/unseen-design-student.txt
# Continue an interrupted validation using saved candidates and source evidence:
node scripts/validate-adaptation.mjs --profile=fixtures/unseen-design-student.txt --resume
```

The validation script uses the same API as the website, creates a student from the supplied text, performs real Groq/search/Scrapling work and exports the result and actual completion status. Each recorded validation pass includes its start/end server-source digest. Development retries are retained in `priorPasses`; a new profile does not select an alternate code path or a stored answer set.

Automated checks cover bachelor/master/doctorate goals, independent student stores, document isolation, original grading scales, exact country constraints, invalidation when preferences change, refresh restoration and a late reply from a previous student. Controlled browser tests do not spend model quota.

A profile can adapt correctly while still having conditional matches or unresolved funding. A shortlist does not guarantee admission or an award. Slow or inaccessible official sources, provider limits, and missing documents are reported explicitly rather than replaced with invented results.
