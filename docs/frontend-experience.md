# ScholarX frontend integration

The supplied `ScholarX Landing Page.html` is now the introduction at `/`. The existing workspace is at `/app`, including `?workspace=...` links. Launch app, Meet your team and Start with ScholarX enter that workspace. New students retain the existing manual-profile-first intake; returning students retain their saved research and chat. The sidebar Home link and rail logo return to the introduction.

## New files

- `src/Landing.jsx`: the supplied hero, five-agent cards, journey, recovery terminal and final launch section, converted into React. The terminal is explicitly an illustrative example, separate from live research results.
- `src/Landing.css`: scoped introduction styles, gold/ivory themes, responsive layout, card tilt, reveal animation, keyboard focus and reduced-motion rules.
- `src/useThreeScene.js`: scene lifecycle, orbiting nodes, data packets, particles, mouse/scroll parallax, pause and hidden-tab controls. Every animation frame, DOM name tag, observer, event listener, geometry, material and renderer is released on unmount. Theme and pause changes update the existing scene without recreating its WebGL context.
- `src/landingThree.js`: only the Three.js exports needed by this scene, loaded dynamically. Three.js was already installed through npm; no CDN or dependency change was needed.
- `src/SiteShell.jsx`: browser-history navigation and one shared appearance owner. After first launch the existing workspace stays mounted but hidden/inert on Home, retaining unsent messages, selected views and ongoing streams. The landing and its WebGL renderer are unmounted inside `/app`.
- `src/design-tokens.css`: shared obsidian, ivory, champagne-gold, surface and text tokens.
- `src/agentEvents.js`: a presentation-only snapshot bridge from existing agent events. Real typing/activity highlights nodes, failure events briefly color lines, and interrupted runs dim the core. It stores no student profile or document content and makes no API calls.
- `tests/browser/landing.spec.js`: navigation, retained state, existing workspace features, shared appearance, rendering/disposal, hidden-tab pause, mobile layout, reduced motion, missing-WebGL fallback and real event bridge.

## Modified frontend files

- `src/main.jsx`: mount SiteShell and load shared tokens before the final workspace theme.
- `src/App.jsx`: accept shared appearance controls, publish existing events to the presentation bridge, add Home navigation and disable its global keyboard shortcuts while hidden. Existing network requests, payloads and orchestration remain intact.
- `src/obsidian.css`: reuse shared color tokens. The earlier cinematic workspace refinement remains in place.
- `src/ui.jsx`: avoid trapping keyboard focus inside a dialog when its workspace is hidden.
- Existing browser specs and developer checks now use `/app` for workspace checks. The production check validates both entry points and refresh behavior.

Earlier saved frontend work is preserved in `ScholarAtmosphere.jsx`, `AgentConstellation.jsx`, `ProfileStart.jsx`, `ResearchWelcome.jsx`, `Appearance.jsx`, `agents.js`, `profile-start.css`, `useAppearance.js`, the favicon and theme metadata. The old globe file `atlas-scene.js` remains removed; the newly requested orbiting-core scene belongs only to the introduction.

## Validation

- Full browser suite: **36 passed** (the 30 existing workspace/design checks plus six landing checks).
- After final scene-sizing refinements, all six landing checks passed again, including hidden-tab suspension.
- Backend tests: **71 passed**.
- `npm run build`: successful. Main JavaScript is approximately 485 kB / 149 kB gzip. Landing is separate (approximately 18 kB / 6 kB gzip), with a lazy Three.js chunk (approximately 523 kB / 131 kB gzip). Vite emits its advisory 500 kB chunk-size warning for Three.js; this is a lazy dependency, not a build error or an active renderer in the workspace.
- Production browser check passed with isolated storage: landing WebGL, launch, profile intake, group chat, Home, and direct `/app` refresh. No page errors.
- Real PDF/Groq profile-first checks from the previous task passed all five checks. This integration does not require repeating those provider calls; backend/config fingerprints confirm all 19 recorded engine/dependency files remain unchanged.
- Chat stream rendering, search, document upload/error handling, Matches/source details, draft actions, Resume research, appearance, student switching/deletion, fixed composer, dialogs and keyboard focus are covered by the browser suite. Browser API fixtures isolate these UI tests from provider quota and actual student workspaces.
- Desktop/tablet/phone checks include widths 320, 390, 768, 1024, 1280, 1440 and 1600. Landing uses reduced pixel density/particle count on phones and a readable CSS fallback without WebGL.
- `git diff --check`: clean.

## Existing limitation

Saved research can still have missing external eligibility/funding/deadline evidence and remains labelled partial in the workspace. The frontend integration does not turn unverified sources into verified recommendations. No backend, secrets or actual student records were changed during this integration.

Preview: `http://127.0.0.1:5173/` · Workspace: `http://127.0.0.1:5173/app`.
