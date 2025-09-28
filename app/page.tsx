"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState, Suspense } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import notionData from "@/data/notion-data.json"
import { SearchBar, type SearchParams } from "@/components/search-bar"
import { Card } from "@/components/ui/card"
import { Star } from "lucide-react"

interface Resource {
  name: string
  description: string
  resourceType: string
  type: "internal" | "external"
  link: string
  eligibility?: string
  importantDates?: string
}

type NotionResource = {
  name: string
  description?: string | null
  resourceType?: string | null
  uscExternal?: string | null
  link?: string | null
  eligibility?: string | null
  importantDates?: string | null
}

const notionResources = notionData as NotionResource[]
const INTERNAL_MATCHERS = ["usc", "internal"]
const EXTERNAL_MATCHERS = ["external"]

function normalizeResourceType(resourceType?: string | null) {
  const trimmed = resourceType?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : "Other"
}

function ResourceSearch({
  onSearch,
  categories,
  showTypeFilter = false,
}: {
  onSearch: (params: SearchParams) => void
  categories: string[]
  showTypeFilter?: boolean
}) {
  return (
    <div className="w-full max-w-3xl mb-4">
      <SearchBar onSearch={onSearch} categories={categories} showTypeFilter={showTypeFilter} />
    </div>
  )
}

export default function Home() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = (searchParams.get("tab") === "basic" ? "basic" : "ai") as "ai" | "basic"
  const [activeTab, setActiveTab] = useState<"ai" | "basic">(initialTab)
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])
  const [aiQuery, setAiQuery] = useState("")
  const [aiResults, setAiResults] = useState<{ resource: Resource; score: number }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [isStreamingSummary, setIsStreamingSummary] = useState(false)
  const streamControllerRef = useRef<AbortController | null>(null)

  const aiExampleQueries = [
    "Freshman interested in edtech",
    "My idea is a robotics manufacturing company",
    "Looking for external startup mentorship programs",
    "Resources for USC students building AI products",
  ]

  // Load resources from static Notion export
  useEffect(() => {
    try {
      const internalResources: Resource[] = notionResources
        .filter((resource) => {
          const label = resource.uscExternal?.toLowerCase() ?? ""
          return INTERNAL_MATCHERS.some((matcher) => label.includes(matcher))
        })
        .map((resource) => ({
          name: resource.name ?? "Untitled Resource",
          description: resource.description ?? "",
          link: resource.link ?? "#",
          resourceType: normalizeResourceType(resource.resourceType),
          type: "internal" as const,
          eligibility: resource.eligibility ?? "",
          importantDates: resource.importantDates ?? "",
        }))

      const externalResources: Resource[] = notionResources
        .filter((resource) => {
          const label = resource.uscExternal?.toLowerCase() ?? ""
          return EXTERNAL_MATCHERS.some((matcher) => label.includes(matcher))
        })
        .map((resource) => ({
          name: resource.name ?? "Untitled Resource",
          description: resource.description ?? "",
          link: resource.link ?? "#",
          resourceType: normalizeResourceType(resource.resourceType),
          type: "external" as const,
        }))

      const allResources = [...internalResources, ...externalResources]
      const uniqueResourceTypes = Array.from(new Set(allResources.map((r) => r.resourceType))).sort((a, b) =>
        a.localeCompare(b)
      )

      setResources(allResources)
      setFilteredResources(allResources)
      setCategories(uniqueResourceTypes)
    } catch (error) {
      console.error("Error loading resources:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load favorites from localStorage
  useEffect(() => {
    const storedFavorites = localStorage.getItem("favorites")
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites))
    }
  }, [])

  useEffect(() => {
    return () => {
      streamControllerRef.current?.abort()
      streamControllerRef.current = null
    }
  }, [])

  const handleSearch = ({ query, category, type }: SearchParams) => {
    let filtered = resources
    const isSearchActive = Boolean(query || (category && category !== "all") || (type && type !== "all"))
    setIsSearching(isSearchActive)

    if (query) {
      const searchQuery = query.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(searchQuery)) ||
          (r.description && r.description.toLowerCase().includes(searchQuery))
      )
    }

    if (category && category !== "all") {
      const lowerCategory = category.toLowerCase()
      filtered = filtered.filter(
        (r) => r.resourceType && r.resourceType.toLowerCase() === lowerCategory
      )
    }

    if (type && type !== "all") {
      filtered = filtered.filter((r) => r.type === type)
    }

    setFilteredResources(filtered)
  }

  type ApiResource = {
    id?: string
    name?: string | null
    description?: string | null
    resourceType?: string | null
    type?: "internal" | "external"
    link?: string | null
    eligibility?: string | null
    importantDates?: string | null
  }

  type ApiResult = {
    resource?: ApiResource | null
    score?: number | null
  }

  type StreamResultsPayload = { results?: ApiResult[] }
  type StreamTokenPayload = { token?: string }
  type StreamSummaryPayload = { summary?: string }
  type StreamErrorPayload = { error?: string }

  const normalizeApiResults = (values: ApiResult[] | undefined | null) => {
    if (!Array.isArray(values)) {
      return [] as { resource: Resource; score: number }[]
    }

    return values.map((item: ApiResult) => {
      const resource = item?.resource ?? {}

      const normalizedResource: Resource = {
        name: resource.name ?? "Untitled Resource",
        description: resource.description ?? "",
        resourceType: normalizeResourceType(resource.resourceType),
        type: resource.type === "external" ? "external" : "internal",
        link: resource.link ?? "#",
        eligibility: resource.eligibility ?? "",
        importantDates: resource.importantDates ?? "",
      }

      return {
        resource: normalizedResource,
        score: typeof item?.score === "number" ? item.score : 0,
      }
    })
  }

  const handleAISubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const trimmedQuery = aiQuery.trim()
    if (aiLoading || !trimmedQuery) {
      return
    }

    streamControllerRef.current?.abort()

    const controller = new AbortController()
    streamControllerRef.current = controller

    setAiLoading(true)
    setAiError(null)
    setAiSummary(null)
    setAiResults([])
    setIsStreamingSummary(false)

    const params = new URLSearchParams({ query: trimmedQuery, stream: "1" })

    const consumeStream = async (response: Response) => {
      const body = response.body
      if (!body) {
        throw new Error("Streaming not supported by this browser")
      }

      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let stop = false
      let sawResults = false
      let summaryFinished = false

      const handleEvent = (rawEvent: string) => {
        if (controller.signal.aborted) {
          stop = true
          return
        }

        const lines = rawEvent.split(/\r?\n/)
        let eventName = "message"
        const dataLines: string[] = []

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart())
          }
        }

        if (dataLines.length === 0) {
          return
        }

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>
        } catch {
          return
        }

        if (eventName === "results") {
          const normalized = normalizeApiResults((payload as StreamResultsPayload).results ?? [])
          setAiResults(normalized)
          setAiLoading(false)
          setIsStreamingSummary(true)
          setAiSummary("")
          sawResults = true
          return
        }

        if (eventName === "summary-token") {
          const token = (payload as StreamTokenPayload).token
          if (typeof token !== "string" || token.length === 0) {
            return
          }
          setAiSummary(prev => (prev ?? "") + token)
          return
        }

        if (eventName === "summary-complete") {
          const summaryValue = (payload as StreamSummaryPayload).summary ?? null
          setAiSummary(summaryValue && summaryValue.trim().length > 0 ? summaryValue : null)
          setIsStreamingSummary(false)
          setAiLoading(false)
          summaryFinished = true
          stop = true
          return
        }

        if (eventName === "summary-error") {
          const errorMessage = (payload as StreamErrorPayload).error
          if (typeof errorMessage === "string" && errorMessage.length > 0) {
            console.warn("Summary streaming error:", errorMessage)
          }
          setAiSummary(null)
          setIsStreamingSummary(false)
          setAiLoading(false)
          summaryFinished = true
          stop = true
          return
        }
      }

      try {
        while (!stop) {
          const { value, done } = await reader.read()
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })

          let separatorIndex: number
          while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex)
            buffer = buffer.slice(separatorIndex + 2)

            if (rawEvent.trim().length === 0) {
              continue
            }

            handleEvent(rawEvent)

            if (stop) {
              break
            }
          }
        }

        if (!stop) {
          buffer += decoder.decode()
        }

        if (buffer.trim().length > 0) {
          handleEvent(buffer)
        }
      } finally {
        reader.releaseLock()

        if (!controller.signal.aborted) {
          if (!sawResults) {
            setAiLoading(false)
          }
          if (!summaryFinished) {
            setIsStreamingSummary(false)
          }
        }
      }
    }

    try {
      const response = await fetch(`/api/ai-search?${params.toString()}`, {
        method: "GET",
        signal: controller.signal,
      })

      const contentType = response.headers.get("Content-Type") ?? ""

      if (contentType.includes("text/event-stream")) {
        await consumeStream(response)
        return
      }

      type SearchResponse = { summary?: unknown; results?: ApiResult[]; error?: string }
      const data = (await response.json().catch(() => ({}))) as SearchResponse

      if (!response.ok) {
        throw new Error(data.error ?? "Search failed")
      }

      const normalized = normalizeApiResults(data.results ?? [])
      setAiResults(normalized)

      const summaryValue = typeof data.summary === "string" ? data.summary.trim() : ""
      setAiSummary(summaryValue.length > 0 ? summaryValue : null)
      setAiLoading(false)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      console.error("AI search failed", error)
      const message = error instanceof Error ? error.message : "Unexpected error"
      setAiError(message)
      setAiResults([])
      setAiSummary(null)
      setAiLoading(false)
      setIsStreamingSummary(false)
    } finally {
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null
      }
    }
  }

  const handleAIExampleClick = (example: string) => {
    setAiQuery(example)
    setTimeout(() => handleAISubmit(), 0)
  }

  const handleAITextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleAISubmit()
    }
  }

  const summaryHasContent = typeof aiSummary === "string" && aiSummary.trim().length > 0
  const summaryDisplay = summaryHasContent
    ? aiSummary
    : isStreamingSummary
      ? typeof aiSummary === "string" && aiSummary.length > 0
        ? aiSummary
        : "Building summary…"
      : "Summary unavailable. Here are the top resources instead."

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-6 pb-16">
      <h1 className="text-3xl md:text-5xl font-bold text-center mb-6 text-primary">
        USC Entrepreneurship Resources
      </h1>

      {/* Tab Toggle with sliding animation */}
      <div className="relative w-full max-w-md h-12 bg-gray-200 rounded-full flex overflow-hidden mb-6">
        {/* Sliding background */}
        <div
          className={`absolute top-0 left-0 w-1/2 h-full bg-primary rounded-full transition-all duration-300`}
          style={{ transform: activeTab === "ai" ? "translateX(0%)" : "translateX(100%)" }}
        />
        {/* Buttons */}
        <button
          className={`flex-1 z-10 font-semibold text-center transition-colors duration-300 ${
            activeTab === "ai" ? "text-white" : "text-gray-700"
          }`}
          onClick={() => {
            setActiveTab("ai")
            // Update URL (shallow) so sharing retains tab state
            router.push("/?tab=ai", { scroll: false })
          }}
        >
          AI Search
        </button>
        <button
          className={`flex-1 z-10 font-semibold text-center transition-colors duration-300 ${
            activeTab === "basic" ? "text-white" : "text-gray-700"
          }`}
          onClick={() => {
            setActiveTab("basic")
            router.push("/?tab=basic", { scroll: false })
          }}
        >
          Basic Search
        </button>
      </div>

      {/* AI Search Tab */}
      {activeTab === "ai" && (
        <div className="w-full max-w-3xl flex flex-col items-center">
          <form onSubmit={handleAISubmit} className="w-full">
            <textarea
              className="w-full p-4 rounded-lg border border-gray-300 focus:border-primary focus:ring focus:ring-primary/30 mb-3"
              placeholder="Ask about USC Entrepreneurship Resources..."
              rows={4}
              value={aiQuery}
              onChange={(event) => setAiQuery(event.target.value)}
              onKeyDown={handleAITextareaKeyDown}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={aiLoading}
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 mt-4">
            {aiExampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleAIExampleClick(example)}
                className="px-3 py-1 rounded-full bg-primary text-white text-sm hover:bg-primary/80"
              >
                {example}
              </button>
            ))}
          </div>

          {aiLoading && <p className="text-muted-foreground mt-4">Finding the best response…</p>}

          {aiError && !aiLoading && (
            <p className="text-sm text-red-600 mt-4 text-center">{aiError}</p>
          )}

          {aiResults.length > 0 && !aiLoading && (
            <div className="w-full mt-6 space-y-4">
              <div className="w-full rounded-lg border bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-primary mb-2">LLM Summary</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {summaryDisplay}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {aiResults.map(({ resource, score }, index) => (
                  <Card key={`${resource.name}-${index}`} className="p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-lg text-primary mb-1">{resource.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2">Match score: {(score * 100).toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {resource.description || "No description provided."}
                    </p>
                    <p className="text-xs text-secondary-foreground mb-2">{resource.resourceType}</p>
                    <a
                      href={resource.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-900 hover:underline text-sm"
                    >
                      Visit Resource
                    </a>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!aiLoading && !aiError && aiResults.length === 0 && aiQuery && (
            <p className="text-center text-muted-foreground mt-4">No results found for "{aiQuery}"</p>
          )}
        </div>
      )}

      {/* Basic Search Tab */}
      {activeTab === "basic" && (
        <>
          <Suspense fallback={<div className="w-full max-w-3xl mb-4 h-40 bg-gray-100 animate-pulse rounded-lg"></div>}>
            <ResourceSearch onSearch={handleSearch} categories={categories} showTypeFilter={true} />
          </Suspense>

          {!isSearching ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl mb-16">
              {/* Internal */}
              <Link
                href="/internal-resources"
                className="group relative overflow-hidden rounded-2xl aspect-[16/9] shadow-lg hover:shadow-xl transition-all duration-500 mb-4 md:mb-0"
              >
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-3ENBMsRnXH8lODgsfoNvUPDrSAX3S2.png"
                  alt="USC Campus"
                  fill
                  className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
                <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-500 group-hover:translate-y-[-4px]">
                  <h2 className="text-xl md:text-2xl font-bold text-white">Internal Resources</h2>
                </div>
              </Link>

              {/* External */}
              <Link
                href="/external-resources"
                className="group relative overflow-hidden rounded-2xl aspect-[16/9] shadow-lg hover:shadow-xl transition-all duration-500 mb-4 md:mb-0"
              >
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-6UvMPZwjJ4vX0T5SGZzF6pgvPuNn2m.png"
                  alt="Los Angeles Skyline"
                  fill
                  className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
                <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-500 group-hover:translate-y-[-4px]">
                  <h2 className="text-xl md:text-2xl font-bold text-white">External Resources</h2>
                </div>
              </Link>

              {/* Favorites */}
              <Link
                href="/favorites"
                className="group relative overflow-hidden rounded-2xl aspect-[16/9] shadow-lg hover:shadow-xl transition-all duration-500 mb-16 md:mb-0"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <Star className="h-16 w-16 text-white mb-4 fill-transparent group-hover:fill-white transition-all duration-700" />
                  <h2 className="text-xl md:text-2xl font-bold text-white text-center">Favorites</h2>
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex-1 w-full max-w-6xl overflow-auto pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <Link
                    key={resource.name}
                    href={resource.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-secondary hover:-translate-y-0.5 relative">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {resource.name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600">{resource.description}</p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
