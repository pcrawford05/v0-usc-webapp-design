import fs from "fs"
import path from "path"
import fetch from "node-fetch"
import { config } from "dotenv"

import type { Resource as EmbeddingResource, ResourceEmbedding } from "../lib/embeddings"

// Load environment variables from .env.local when present (Vercel exposes values via process.env)
if (fs.existsSync(".env.local")) {
  config({ path: ".env.local", override: false })
} else {
  config()
}

const notionToken = process.env.NOTION_API_KEY
const databaseId = process.env.NOTION_DATABASE_ID

if (!notionToken || !databaseId) {
  console.error("❌ Missing NOTION_API_KEY or NOTION_DATABASE_ID")
  process.exit(1)
}

const DATA_DIR = path.resolve(process.cwd(), "data")
const NOTION_DATA_PATH = path.join(DATA_DIR, "notion-data.json")
const EMBEDDINGS_PATH = path.join(DATA_DIR, "embeddings.json")

// ---------------------- Types ----------------------

interface NotionRichText {
  plain_text: string
}

interface NotionTitleProperty {
  title: NotionRichText[]
}

interface NotionSelectProperty {
  select: {
    name: string
  } | null
}

interface NotionRichTextProperty {
  rich_text: NotionRichText[]
}

interface NotionUrlProperty {
  url: string | null
}

interface NotionDateProperty {
  date: {
    start: string
  } | null
}

interface NotionPageProperties {
  Name: NotionTitleProperty
  "Resource Type": NotionSelectProperty
  "USC/External": NotionSelectProperty
  Description: NotionRichTextProperty
  Eligibility: NotionRichTextProperty
  Link: NotionUrlProperty
  "Important Dates": NotionDateProperty
}

interface NotionPage {
  id: string
  last_edited_time: string
  properties: NotionPageProperties
}

interface NotionQueryResponse {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}

interface ProcessedResource {
  id: string
  last_edited_time: string
  name: string
  resourceType: string | null
  uscExternal: string | null
  description: string | null
  eligibility: string | null
  link: string | null
  importantDates: string | null
}

// Safely extract plain text from Notion rich_text/array fields
function getText(obj: NotionRichText[] | undefined | null): string | null {
  if (!obj) return null
  if (Array.isArray(obj)) {
    return obj.map((t: NotionRichText) => t.plain_text).join(" ")
  }
  return null
}

// ---------------------- Notion Fetching ----------------------

async function fetchDatabase(): Promise<ProcessedResource[]> {
  let results: NotionPage[] = []
  let hasMore = true
  let startCursor: string | undefined = undefined

  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(startCursor ? { start_cursor: startCursor } : {}),
    })

    if (!res.ok) {
      console.error("❌ Error fetching Notion:", await res.text())
      process.exit(1)
    }

    const data = (await res.json()) as NotionQueryResponse
    results = results.concat(data.results)

    hasMore = data.has_more
    startCursor = data.next_cursor || undefined
  }

  return results.map((page: NotionPage): ProcessedResource => {
    const props = page.properties

    return {
      id: page.id,
      last_edited_time: page.last_edited_time,
      name: props["Name"]?.title?.map((t: NotionRichText) => t.plain_text).join(" ") || "",
      resourceType: props["Resource Type"]?.select?.name || null,
      uscExternal: props["USC/External"]?.select?.name || null,
      description: getText(props["Description"]?.rich_text) || null,
      eligibility: getText(props["Eligibility"]?.rich_text) || null,
      link: props["Link"]?.url || null,
      importantDates: props["Important Dates"]?.date?.start || null,
    }
  })
}

// ---------------------- Change Detection ----------------------

function normalizeForComparison(resource: ProcessedResource) {
  return {
    last_edited_time: resource.last_edited_time,
    name: resource.name,
    resourceType: resource.resourceType ?? "",
    uscExternal: resource.uscExternal ?? "",
    description: resource.description ?? "",
    eligibility: resource.eligibility ?? "",
    link: resource.link ?? "",
    importantDates: resource.importantDates ?? "",
  }
}

function detectChanges(
  previous: ProcessedResource[],
  next: ProcessedResource[]
): {
  changed: ProcessedResource[]
  deletedIds: string[]
} {
  const previousMap = new Map(previous.map((resource) => [resource.id, resource]))
  const nextMap = new Map(next.map((resource) => [resource.id, resource]))

  const changed: ProcessedResource[] = []

  for (const resource of next) {
    const existing = previousMap.get(resource.id)
    if (!existing) {
      changed.push(resource)
      continue
    }

    const prevSnapshot = normalizeForComparison(existing)
    const nextSnapshot = normalizeForComparison(resource)

    if (JSON.stringify(prevSnapshot) !== JSON.stringify(nextSnapshot)) {
      changed.push(resource)
    }
  }

  const deletedIds = previous
    .filter((resource) => !nextMap.has(resource.id))
    .map((resource) => resource.id)

  return { changed, deletedIds }
}

// ---------------------- Embedding Helpers ----------------------

function toEmbeddingResource(resource: ProcessedResource): EmbeddingResource {
  const label = resource.uscExternal?.toLowerCase() ?? ""
  let type: "internal" | "external" | undefined
  if (label.includes("external")) {
    type = "external"
  } else if (label.includes("usc") || label.includes("internal")) {
    type = "internal"
  }

  return {
    id: resource.id,
    name: resource.name,
    description: resource.description ?? undefined,
    resourceType: resource.resourceType ?? undefined,
    type,
    link: resource.link ?? undefined,
    eligibility: resource.eligibility ?? undefined,
    importantDates: resource.importantDates ?? undefined,
  }
}

async function updateEmbeddings(
  allResources: ProcessedResource[],
  changedResources: ProcessedResource[],
  deletedIds: string[]
) {
  const changedIds = new Set(changedResources.map((resource) => resource.id))
  const deletedIdSet = new Set(deletedIds)

  const existingEmbeddings: ResourceEmbedding[] = fs.existsSync(EMBEDDINGS_PATH)
    ? JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, "utf-8"))
    : []

  const keptEmbeddings = existingEmbeddings.filter(
    (embedding) => !changedIds.has(embedding.resource.id) && !deletedIdSet.has(embedding.resource.id)
  )

  if (changedResources.length === 0 && deletedIds.length === 0) {
    if (!fs.existsSync(EMBEDDINGS_PATH)) {
      console.log("ℹ️ No existing embeddings file to update.")
    } else {
      console.log("ℹ️ Embeddings already up to date; no changes detected.")
    }
    return
  }

  let finalEmbeddings: ResourceEmbedding[] = keptEmbeddings

  if (changedResources.length > 0) {
    const embeddingsModule = (await import(
      new URL("../lib/embeddings.ts", import.meta.url).href
    )) as typeof import("../lib/embeddings")
    const { computeAllEmbeddings } = embeddingsModule
    const resourcesForEmbedding = changedResources.map(toEmbeddingResource)

    const updatedEmbeddings = await computeAllEmbeddings(resourcesForEmbedding, {
      existingEmbeddings: keptEmbeddings,
      onProgress: (resource) => console.log(`🧠 Generating embedding for: ${resource.name}`),
      onError: (resource, error) => console.error(`❌ Failed embedding for ${resource.name}`, error),
    })

    const embeddingMap = new Map<string, ResourceEmbedding>()

    for (const entry of [...keptEmbeddings, ...updatedEmbeddings]) {
      embeddingMap.set(entry.resource.id, entry)
    }

    finalEmbeddings = allResources
      .map((resource) => embeddingMap.get(resource.id))
      .filter((entry): entry is ResourceEmbedding => Boolean(entry))

    console.log(`✅ Updated embeddings for ${updatedEmbeddings.length} resource(s)`)
  } else {
    const remainingIds = new Set(allResources.map((resource) => resource.id))
    finalEmbeddings = keptEmbeddings.filter((embedding) => remainingIds.has(embedding.resource.id))
    console.log("✅ Removed embeddings for deleted resources")
  }

  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(finalEmbeddings, null, 2))
  console.log(`🧾 Saved ${finalEmbeddings.length} embeddings → ${EMBEDDINGS_PATH}`)
}

// ---------------------- Main ----------------------

;(async () => {
  try {
    console.log("🚀 Fetching Notion database...")
    const pages = await fetchDatabase()

    const previousResources: ProcessedResource[] = fs.existsSync(NOTION_DATA_PATH)
      ? JSON.parse(fs.readFileSync(NOTION_DATA_PATH, "utf-8"))
      : []

    const { changed, deletedIds } = detectChanges(previousResources, pages)

    if (changed.length === 0 && deletedIds.length === 0) {
      console.log("✨ Notion content is already up to date. No changes detected.")
      return
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      console.log("📁 Created data directory")
    }

    fs.writeFileSync(NOTION_DATA_PATH, JSON.stringify(pages, null, 2))
    console.log(`✅ Saved ${pages.length} resources → ${NOTION_DATA_PATH}`)

    const changeSummary: string[] = [`${changed.length} updated/new resource(s)`]
    if (deletedIds.length > 0) {
      changeSummary.push(`${deletedIds.length} deletion(s)`)
    }
    console.log(`🔄 Detected ${changeSummary.join(" and ")}`)

    await updateEmbeddings(pages, changed, deletedIds)
  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
})()
