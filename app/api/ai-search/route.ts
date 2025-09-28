import { promises as fs } from "node:fs"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

import { getEmbedding, semanticSearch, type ResourceEmbedding } from "@/lib/embeddings"
import { generateSummary, streamSummary, type SummaryItem } from "@/lib/llm"

const EMBEDDINGS_PATH = path.join(process.cwd(), "data/embeddings.json")

let cachedEmbeddings: ResourceEmbedding[] | null = null

type SearchMatch = ResourceEmbedding & { score: number }

async function loadEmbeddings(): Promise<ResourceEmbedding[]> {
  if (cachedEmbeddings) {
    return cachedEmbeddings
  }

  try {
    const fileContents = await fs.readFile(EMBEDDINGS_PATH, "utf-8")
    const parsed = JSON.parse(fileContents) as ResourceEmbedding[]

    cachedEmbeddings = parsed
    return parsed
  } catch (error) {
    console.error("Failed to read embeddings.json", error)
    throw new Error("Embeddings data is unavailable. Have you generated embeddings yet?")
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body.query !== "string" || body.query.trim().length === 0) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 })
    }

    const matches = await performSemanticSearch(body.query)
    const summary = await safeGenerateSummary(body.query, matches)

    return NextResponse.json({
      summary,
      results: serializeMatches(matches),
    })
  } catch (error) {
    console.error("AI search failed", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const query = searchParams.get("query") ?? ""

    if (!query.trim()) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 })
    }

    const shouldStream = isStreamRequest(searchParams.get("stream"))
    const matches = await performSemanticSearch(query)

    if (!shouldStream) {
      const summary = await safeGenerateSummary(query, matches)
      return NextResponse.json({ summary, results: serializeMatches(matches) })
    }

    const stream = createSummaryStream(query, matches)
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("AI search failed", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function performSemanticSearch(query: string): Promise<SearchMatch[]> {
  const embeddings = await loadEmbeddings()

  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error("No embeddings available")
  }

  const queryEmbedding = await getEmbedding(query)
  return semanticSearch(queryEmbedding, embeddings, 5)
}

function serializeMatches(matches: SearchMatch[]) {
  return matches.map(match => ({
    resource: match.resource,
    score: match.score,
  }))
}

function toSummaryItems(matches: SearchMatch[]): SummaryItem[] {
  return matches.map(match => ({
    resource: match.resource,
    score: match.score,
  }))
}

async function safeGenerateSummary(query: string, matches: SearchMatch[]): Promise<string | null> {
  if (matches.length === 0) {
    return null
  }

  try {
    const summary = await generateSummary(query, toSummaryItems(matches))
    if (typeof summary === "string") {
      const trimmed = summary.trim()
      return trimmed.length > 0 ? trimmed : null
    }
  } catch (summaryError) {
    console.error("Summary generation failed", summaryError)
  }

  return null
}

function isStreamRequest(value: string | null): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

function createSummaryStream(query: string, matches: SearchMatch[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const summaryItems = toSummaryItems(matches)

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = formatSse(event, data)
        controller.enqueue(encoder.encode(payload))
      }

      send("results", { results: serializeMatches(matches) })

      if (summaryItems.length === 0) {
        send("summary-complete", { summary: null })
        controller.close()
        return
      }

      let buffer = ""

      try {
        const finalSummary = await streamSummary(query, summaryItems, {
          onToken: token => {
            if (!token) {
              return
            }
            buffer += token
            send("summary-token", { token })
          },
        })

        if (finalSummary && finalSummary.length > 0) {
          const trimmedFinal = finalSummary.trim()

          if (!trimmedFinal.startsWith(buffer)) {
            const diff = trimmedFinal.slice(buffer.length)
            if (diff) {
              buffer += diff
              send("summary-token", { token: diff })
            } else {
              buffer = trimmedFinal
            }
          } else {
            buffer = trimmedFinal
          }

          send("summary-complete", { summary: trimmedFinal })
          return
        }

        const trimmedBuffer = buffer.trim()
        send("summary-complete", { summary: trimmedBuffer.length > 0 ? trimmedBuffer : null })
      } catch (error) {
        console.error("Summary streaming failed", error)
        const fallback = await safeGenerateSummary(query, matches)

        if (fallback && fallback.trim().length > 0) {
          const trimmed = fallback.trim()

          if (buffer.length === 0) {
            send("summary-token", { token: trimmed })
          } else if (!trimmed.startsWith(buffer)) {
            send("summary-token", { token: trimmed })
          } else {
            const diff = trimmed.slice(buffer.length)
            if (diff) {
              send("summary-token", { token: diff })
            }
          }

          send("summary-complete", { summary: trimmed })
        } else {
          send("summary-error", { error: "Summary generation failed" })
        }
      } finally {
        controller.close()
      }
    },
  })
}

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}
