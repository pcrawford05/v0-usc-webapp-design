# USC Startup Atlas

Every USC entrepreneurship program in one place: 167 USC programs plus 36 outside founder resources, each with timing, eligibility, funding, a description and an official link.

[Live app](https://v0-usc-webapp-design.vercel.app/)

## What it does

| View | What it is for |
|---|---|
| **Explore** | Zoomable bubble map. Schools and units are clusters; tap one to zoom into its categories, tap again to see programs, hover for a preview, click for details. Search dims everything that does not match. |
| **Find my path** | Three taps (who you are, venture stage, what you need) produce a ranked shortlist. |
| **Browse** | Card grid with filters by unit, type, audience and verified-only. |
| **Calendar** | The next 12 months of deadlines and events, starting with the current month, plus everything that runs year-round. |
| **Ask AI** | Chat grounded only in the catalog. Answers come back as program cards with a tailored reason for each. |
| **Saved** | Bookmarks stored in the browser, with a one-click "plan my next 6 months". |

Every program has a shareable link: `/?p=<program-id>` opens its detail panel.

## Single source of truth

`data/programs.json` holds every program and drives every view and the AI. One record looks like this:

```json
{
  "id": "maseeh-entrepreneurship-prize-competition",
  "name": "Maseeh Entrepreneurship Prize Competition",
  "group": "viterbi",
  "category": "Competitions & Pitch",
  "description": "...",
  "timing": "Annual; applications open in the fall, winners announced in late April",
  "cadence": "annual",
  "months": [1, 4],
  "eligibility": "...",
  "audience": ["undergrad", "grad", "phd"],
  "stage": ["prototype", "launched"],
  "funding": "...",
  "link": "https://...",
  "sources": ["https://..."],
  "confidence": "high",
  "notes": null
}
```

The schema and allowed values are defined in `lib/programs.ts`. To update a program, edit the JSON and commit; Vercel redeploys. Entries marked `"confidence": "low"` show a "confirm on the official page" note in the app. The ones that need an owner's review are listed in [`docs/programs-needing-verification.md`](docs/programs-needing-verification.md).

`scripts/build-programs.mjs` merges and validates new research batches into `data/programs.json` (`pnpm data:build <dir>`).

## AI setup (free tier)

The AI ranks the catalog locally, then asks a free-tier model to write a grounded answer. It tries providers in order:

1. **Google Gemini**: set `GEMINI_API_KEY` (free key at https://aistudio.google.com/apikey). The default model is `gemini-flash-lite-latest`, which has the largest free daily quota. Set `GEMINI_MODEL=gemini-flash-latest` for higher quality at a lower daily quota.
2. **Groq**: set `GROQ_API_KEY` (free key at https://console.groq.com/keys). This is the fallback if Gemini is rate limited.
3. **No key**: Ask AI still returns the best keyword matches.

Add the keys in Vercel under Project Settings, Environment Variables, then redeploy. For local development, copy `.env.example` to `.env.local`. The API route rate-limits each visitor (12 questions per minute) to protect the free quota.

## Development

```bash
pnpm install
pnpm dev
```

Stack: Next.js 15, React 19, Tailwind, d3-hierarchy (bubble layout).
