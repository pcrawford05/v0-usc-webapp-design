import fetch from "node-fetch"

const HF_API_KEY = process.env.HF_API_KEY

export interface Resource {
  name: string
  description: string
  resourceType?: string
  type?: "internal" | "external"
  link?: string
  eligibility?: string
  importantDates?: string
}

interface HuggingFaceEmbeddingResponse {
  data: { embedding: number[] }[]
}

interface ResourceEmbedding {
  resource: Resource
  embedding: number[]
}

// Get embedding for a single text
export async function getEmbedding(text: string): Promise<number[]> {
  if (!HF_API_KEY) throw new Error("HF_API_KEY not set")

  const response = await fetch(
    "https://api-inference.huggingface.co/embeddings/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    }
  )

  const data = (await response.json()) as HuggingFaceEmbeddingResponse

  if (!data.data || !data.data[0]?.embedding)
    throw new Error("No embedding returned from Hugging Face")

  return data.data[0].embedding
}

// Cosine similarity
export function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dot / (normA * normB)
}

// Cache embeddings
let cachedEmbeddings: ResourceEmbedding[] = []

// Compute embeddings for all resources
export async function computeAllEmbeddings(resources: Resource[]): Promise<ResourceEmbedding[]> {
  if (cachedEmbeddings.length === 0) {
    for (const r of resources) {
      const emb = await getEmbedding(`${r.name}. ${r.description}`)
      cachedEmbeddings.push({ resource: r, embedding: emb })
    }
  }
  return cachedEmbeddings
}

// Semantic search: return top K matching resources with score
export function semanticSearch(
  queryEmbedding: number[],
  resources: ResourceEmbedding[],
  topK = 5
): (Resource & { score: number })[] {
  return resources
    .map(r => ({ ...r.resource, score: cosineSim(queryEmbedding, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
