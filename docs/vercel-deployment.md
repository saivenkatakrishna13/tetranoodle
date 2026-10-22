# Deploy ScholarX with Vercel

ScholarX has a Vite/React frontend and a persistent research API. Deploy the frontend to **Vercel** and the existing Node/Python API to a persistent web service. This keeps live research, server-sent events, Scrapling, uploads, and saved student work working exactly as they do locally.

Vercel Functions are not used for the research API: a research run continues after its start request, streams progress, invokes Python/Scrapling, and stores workspace state. Those requirements need a long-running process and persistent disk.

## 1. Deploy the API

Create a Render Web Service from the same GitHub repository. `render.yaml` supplies the build and start commands.

Add a persistent disk mounted at `/var/data`, then add these environment variables in Render:

```dotenv
NODE_ENV=production
PYTHON_PATH=.venv/bin/python
TETRA_DATA_DIR=/var/data/sessions
APP_ORIGIN=https://your-project.vercel.app
GROQ_API_KEY_MIRA=...
GROQ_API_KEY_ARJUN=...
GROQ_API_KEY_NOVA=...
GROQ_API_KEY_SAGE=...
GROQ_API_KEY_LEO=...
```

Copy any optional search variables you use locally, such as `TAVILY_API_KEY`, `SERPER_API_KEY`, `BRAVE_SEARCH_API_KEY`, and `GITHUB_TOKEN`. Never add secrets to GitHub or Vercel's frontend variables.

After the API is live, open `https://your-scholarx-api.onrender.com/api/status`. It should return JSON.

## 2. Deploy the frontend on Vercel

Import this GitHub repository as a Vercel project. Vercel uses `vercel.json` to build the Vite app and preserve client-side routes such as `/app`.

Set this Vercel environment variable for **Production, Preview, and Development**:

```dotenv
VITE_API_BASE_URL=https://your-scholarx-api.onrender.com
```

Redeploy the Vercel project after setting it. Then update `APP_ORIGIN` on Render to the exact production Vercel URL. For preview deployments, add the preview URL as a comma-separated additional `APP_ORIGIN` value.

## 3. Verify

1. Open the Vercel URL and launch the app.
2. Create a new student and save a profile.
3. Confirm `/api/status` reports Groq as connected in the UI.
4. Start research and confirm agent events arrive in the chat.
5. Refresh, reopen the student, and confirm the saved profile and research remain available.

Local development remains unchanged: leave `VITE_API_BASE_URL` blank and run `npm run dev`.
