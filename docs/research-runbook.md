# Weekly research run

How to refresh every program in `data/programs.json` and keep `data/sources.json` (the map of where each fact lives) current. Paste the prompt at the bottom into Claude Code in this repo.

## How a run works

1. **Chunk** the catalog by category into about nine slices of roughly 20 to 25 programs: clubs, courses, funding, competitions and makerspaces, accelerators, events and mentorship, research commercialization and legal, partners, toolkits. Write each slice to its own JSON file.
2. **Research** each slice with one Sonnet agent. It starts from `data/sources.json` (the pages that held the facts last time, the listing pages for its chunk, and the queries that worked), then searches beyond them for anything newer. It proposes changes only with a source it actually opened and records every useful page it found.
3. **Verify** each slice's proposed changes with a separate Sonnet agent that re-opens the cited pages and confirms, corrects or rejects each one. It is strictest on eligibility, dates and funding.
4. **Apply** with `node scripts/apply-research.mjs <results.json> <YYYY-MM-DD>`. Only verified values are written. Each program gets `lastVerified`, the registry is updated, and a log lands in `docs/research-runs/<date>.json`.
5. **Review** the diff of `data/programs.json` by hand before committing: look for eligibility that widened, prizes that changed by an order of magnitude, and links that moved off usc.edu. Programs flagged `defunct` or `not_found` are listed in the run log; decide whether to remove them.
6. Build, check a few changed programs in the app, then commit and open a PR.

## Reading pages

The WebFetch tool fails in the cloud container (DNS), but `curl` through the proxy works. Agents read pages with:

```sh
curl -sL --max-time 20 -A "Mozilla/5.0" "<url>" | python3 -c "import sys,re,html;t=sys.stdin.read();t=re.sub(r'(?s)<(script|style).*?</\1>','',t);print(re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',t)))[:12000])"
```

If curl returns nothing useful (Cloudflare on viterbiinnovation.usc.edu, pear.vc and hax.co; JavaScript-rendered pages on iovine-young.usc.edu and Engage), read the page with the preinstalled Chromium:

```sh
node scripts/read-page.cjs "<url>"
```

A source counts as checked only if it was actually read. Search snippets do not count.

## Rules the agents follow

- Never invent facts; every change cites a page.
- Audience (undergrad, grad, PhD...) is set only when a source states it. An unconfirmed audience stays empty, so the site says to check with the org.
- Official USC pages first, then the program's own site, then USC Engage or Campus Groups, then news and the org's socials.
- No em dashes in any text.

## Prompt for next week

> Run the weekly Founder Compass research pass described in docs/research-runbook.md. Use data/sources.json as the starting map for each program but do not limit searches to it. Use Sonnet researchers and Sonnet verifiers, one per chunk, apply verified changes with scripts/apply-research.mjs, show me the diff summary, and open a PR.
