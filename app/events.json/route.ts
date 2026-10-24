import events from "@/data/events.json"

// Every dated thing in the catalog: upcoming EngageSC events plus each program's usual months.
// Rebuilt by `node scripts/build-events.mjs` during the weekly research run.
export const dynamic = "force-static"

export function GET() {
  return Response.json(events, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } })
}
