import { pageText } from "@/lib/advisor"

// Plain-text guide for AI assistants (llms.txt convention). The Advisor's prompt points ChatGPT or Claude here,
// so it holds every program and upcoming event, plus links to the machine-readable /programs.json and /events.json.
export const dynamic = "force-static"

const ORIGIN = "https://v0-usc-webapp-design.vercel.app"

export function GET() {
  return new Response(pageText(ORIGIN), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  })
}
