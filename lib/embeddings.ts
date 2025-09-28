import fs from "fs"
import path from "path"
import { config as loadEnv } from "dotenv"
import { HfInference } from "@huggingface/inference"

// ---------------------- Environment Loading ----------------------
// Load .env.local in development (Next.js already loads it for app runtime, but for direct script execution we ensure it here)
if (process.env.NODE_ENV !== "production") {
  loadEnv({ path: ".env.local", override: false })
}

function getRequiredEnv(name: string): string {
  const val = process.env[name]
  if (!val || !val.trim()) {
    throw new Error(`Missing required environment variable: ${name}. Add it to your .env.local file.`)
  }
  return val.trim()
}

// Lazy accessor so the variable is only validated when first used (avoids evaluation at import time during build)
function getHFApiKey(): string {
  return getRequiredEnv("HF_API_KEY")
}

// ---------------------- Types ----------------------

export interface Resource {
  id: string
  name: string
  description?: string
  resourceType?: string
  type?: "internal" | "external"
  link?: string
  eligibility?: string
  importantDates?: string
}

type HFEmbeddingVector = number[] | Float32Array
type HFEmbeddingPayload =
  | HFEmbeddingVector
  | HFEmbeddingVector[]
  | { error: string; estimated_time?: number; message?: string }

let hfClient: HfInference | null = null

export function getHfClient(): HfInference {
  if (!hfClient) {
    hfClient = new HfInference(getHFApiKey())
  }
  return hfClient
}

export interface ResourceEmbedding {
  resource: Resource
  embedding: number[]
  lastUpdated: string
}

// ---------------------- Helpers ----------------------

// Get embedding for a single text
export async function getEmbedding(text: string): Promise<number[]> {
  const client = getHfClient()

  let data: HFEmbeddingPayload
  try {
    data = (await client.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
      // wait_for_model ensures cold models are loaded once and avoids 503 streaming errors
      options: { wait_for_model: true },
    })) as HFEmbeddingPayload
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw new Error(`Hugging Face featureExtraction failed: ${(error as Error).message}`)
    }
    throw error
  }

  const normalized = normalizeEmbeddingPayload(data)
  if (!normalized) {
    throw new Error(`Unexpected embedding payload from Hugging Face: ${JSON.stringify(data).slice(0, 300)}`)
  }

  return normalized
}

function normalizeEmbeddingPayload(payload: HFEmbeddingPayload): number[] | null {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return null
    }

    if (Array.isArray(payload[0]) || payload[0] instanceof Float32Array) {
      const tokenVectors = payload as HFEmbeddingVector[]
      const vectorLength = Array.from(tokenVectors[0]).length
      const sum = new Array(vectorLength).fill(0)

      for (const tokenVector of tokenVectors) {
        const values = Array.from(tokenVector)
        if (values.length !== vectorLength) {
          throw new Error("Inconsistent embedding dimensions returned from Hugging Face API")
        }
        for (let i = 0; i < vectorLength; i++) {
          sum[i] += values[i]
        }
      }

      return sum.map(value => value / tokenVectors.length)
    }

    if (payload.every(val => typeof val === "number")) {
      return payload as number[]
    }
  }

  if (payload instanceof Float32Array) {
    return Array.from(payload)
  }

  if (typeof payload === "object" && payload !== null && "error" in payload) {
    throw new Error(`Hugging Face API error payload: ${payload.error}`)
  }

  return null
}

function buildResourceSearchText(resource: Resource): string {
  const segments: string[] = [resource.name]

  if (resource.description) {
    segments.push(resource.description)
  }

  if (resource.eligibility) {
    segments.push(`Eligibility: ${resource.eligibility}`)
  }

  if (resource.importantDates) {
    segments.push(`Important Dates: ${resource.importantDates}`)
  }

  return segments.join(". ")
}

export async function computeAllEmbeddings(
  resources: Resource[],
  options: {
    existingEmbeddings?: Iterable<ResourceEmbedding>
    onProgress?: (resource: Resource) => void
    onError?: (resource: Resource, error: unknown) => void
  } = {}
): Promise<ResourceEmbedding[]> {
  const { existingEmbeddings = [], onProgress, onError } = options
  const existingMap = new Map<string, ResourceEmbedding>()

  for (const entry of existingEmbeddings) {
    existingMap.set(entry.resource.id, entry)
  }

  const results: ResourceEmbedding[] = []

  for (const resource of resources) {
    const cached = existingMap.get(resource.id)
    if (cached) {
      results.push(cached)
      continue
    }

    onProgress?.(resource)

    try {
      const embedding = await getEmbedding(buildResourceSearchText(resource))
      results.push({
        resource,
        embedding,
        lastUpdated: new Date().toISOString(),
      })
    } catch (error) {
      onError?.(resource, error)
    }
  }

  return results
}

export function semanticSearch(
  queryEmbedding: number[],
  resourceEmbeddings: ResourceEmbedding[],
  limit = 5
): Array<ResourceEmbedding & { score: number }> {
  return resourceEmbeddings
    .map(entry => ({
      ...entry,
      score: cosineSim(queryEmbedding, entry.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Cosine similarity
export function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dot / (normA * normB)
}

// ---------------------- Main Pipeline ----------------------

const DATA_PATH = path.resolve("./data/notion-data.json")
const EMBEDDINGS_PATH = path.resolve("./data/embeddings.json")

async function main() {
  // 1. Read resources from Notion export
  const raw = fs.readFileSync(DATA_PATH, "utf-8")
  const resources = JSON.parse(raw) as Resource[]
  console.log(`Loaded ${resources.length} resources from notion-data.json`)

  // 2. Load existing embeddings if they exist
  let existingEmbeddings: ResourceEmbedding[] = []
  if (fs.existsSync(EMBEDDINGS_PATH)) {
    const rawEmb = fs.readFileSync(EMBEDDINGS_PATH, "utf-8")
    existingEmbeddings = JSON.parse(rawEmb) as ResourceEmbedding[]
    console.log(`Loaded ${existingEmbeddings.length} existing embeddings`)
  }

  // 3. Compute embeddings (reusing cached entries when possible)
  const embeddings = await computeAllEmbeddings(resources, {
    existingEmbeddings,
    onProgress: resource => {
      console.log(`Generating embedding for: ${resource.name}`)
    },
    onError: (resource, error) => {
      console.error(`Failed to generate embedding for ${resource.name}:`, error)
    },
  })

  // 4. Save embeddings.json
  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(embeddings, null, 2))
  console.log(`Saved ${embeddings.length} embeddings to ${EMBEDDINGS_PATH}`)
}

// Only run if executed directly
if (import.meta.url === `file://${process.cwd()}/lib/embeddings.ts`) {
  // Validate early when running directly to fail fast with clear message
  getHFApiKey()
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
