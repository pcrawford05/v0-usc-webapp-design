import { getEngageEvents } from "@/lib/engage"

// Rebuilt at most once a day: one small iCal request per Engage group, then served from cache.
export const revalidate = 86400

export async function GET() {
  const events = await getEngageEvents()
  return Response.json(
    { source: "https://engage.usc.edu", updated: new Date().toISOString(), count: events.length, events },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } },
  )
}
