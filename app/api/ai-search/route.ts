import { promises as fs } from "node:fs"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

import { getEmbedding, semanticSearch, type ResourceEmbedding } from "@/lib/embeddings"
import { generateSummary } from "@/lib/llm"

const EMBEDDINGS_PATH = path.join(process.cwd(), "data/embeddings.json")

let cachedEmbeddings: ResourceEmbedding[] | null = null

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

    const embeddings = await loadEmbeddings()

    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      return NextResponse.json({ error: "No embeddings available" }, { status: 500 })
    }

    const queryEmbedding = await getEmbedding(body.query)
    const matches = semanticSearch(queryEmbedding, embeddings, 5)

    let summary: string | null = null
    try {
      summary = await generateSummary(
        body.query,
        matches.map(match => ({ resource: match.resource, score: match.score }))
      )
    } catch (summaryError) {
      console.error("Summary generation failed", summaryError)
    }

    return NextResponse.json({
      summary,
      results: matches.map(match => ({
        resource: match.resource,
        score: match.score,
      })),
    })
  } catch (error) {
    console.error("AI search failed", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
