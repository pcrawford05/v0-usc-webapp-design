import { NextRequest, NextResponse } from "next/server"
import { getEmbedding, computeAllEmbeddings, semanticSearch } from "@/lib/embeddings"

export async function POST(req: NextRequest) {
  try {
    const { query, resources } = await req.json()

    if (!query || !resources) {
      return NextResponse.json({ error: "Missing query or resources" }, { status: 400 })
    }

    const allEmbeddings = await computeAllEmbeddings(resources)
    const queryEmb = await getEmbedding(query)
    const results = semanticSearch(queryEmb, allEmbeddings, 5)

    return NextResponse.json(results)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
