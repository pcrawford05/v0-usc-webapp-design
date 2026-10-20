// Plain-text guide for AI agents (llms.txt convention) pointing at the machine-readable catalog.
export const dynamic = "force-static"

export function GET(req: Request) {
  const origin = new URL(req.url).origin
  return new Response(
    `# Founder Compass

> A directory of USC entrepreneurship programs and outside founder resources.

## Data
- [Program catalog (JSON)](${origin}/programs.json): every program with group, category, description, timing, eligibility, audience, stage, funding, official link, sources and a confidence rating.

## Notes
- Entries rated "low" confidence need verification against the official link.
- Corrections: email pcrawfor@usc.edu with the program id, the field, and a source URL.
`,
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" } },
  )
}
