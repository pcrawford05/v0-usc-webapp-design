import programs from "@/data/programs.json"

// Public, machine-readable catalog so other tools and AI agents can read or audit the data.
export const dynamic = "force-static"

export function GET() {
  return Response.json(
    {
      name: "USC Startup Atlas program catalog",
      description: "Entrepreneurship programs and founder resources at USC and beyond. Details are researched from public sources; confirm on each program's official link.",
      updated: new Date().toISOString().slice(0, 10),
      count: programs.length,
      fields: {
        confidence: "high | medium | low: how well the details are verified against official sources",
        months: "1-12, the months a deadline or event usually falls in",
        sources: "URLs the details were drawn from",
      },
      programs,
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  )
}
