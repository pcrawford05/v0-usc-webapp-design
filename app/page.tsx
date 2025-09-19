"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, Suspense } from "react"
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
  const [activeTab, setActiveTab] = useState<"ai" | "basic">("ai")
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])

  // Fetch resources from API
  useEffect(() => {
    async function fetchAllResources() {
      try {
        const [internalRes, externalRes] = await Promise.all([
          fetch("/api/internal-resources"),
          fetch("/api/external-resources"),
        ])

        const internalData = await internalRes.json()
        const externalData = await externalRes.json()

        const internalResources = internalData.flatMap((group: any) =>
          group.items
            .filter((item: any) => item.name && !item.name.toLowerCase().includes("http"))
            .map((item: any) => ({
              name: item.name ?? "",
              description: item.description ?? "",
              link: item.link ?? "#",
              resourceType: group.resourceType ?? "Unknown",
              type: "internal" as const,
              eligibility: item.eligibility ?? "",
              importantDates: item.importantDates ?? "",
            }))
        )

        const externalResources = externalData.flatMap((group: any) =>
          group.items
            .filter((item: any) => item.name && !item.name.toLowerCase().includes("http"))
            .map((item: any) => ({
              name: item.name ?? "",
              description: item.description ?? "",
              link: item.link ?? "#",
              resourceType: group.resourceType ?? "Unknown",
              type: "external" as const,
            }))
        )

        const allResources = [...internalResources, ...externalResources]
        const uniqueResourceTypes = Array.from(
          new Set(allResources.map((r) => r.resourceType))
        ).filter((rt): rt is string => typeof rt === "string" && rt !== "Unknown")

        setResources(allResources)
        setCategories(uniqueResourceTypes)
      } catch (error) {
        console.error("Error fetching resources:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllResources()
  }, [])

  // Load favorites from localStorage
  useEffect(() => {
    const storedFavorites = localStorage.getItem("favorites")
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites))
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
          onClick={() => setActiveTab("ai")}
        >
          AI Search
        </button>
        <button
          className={`flex-1 z-10 font-semibold text-center transition-colors duration-300 ${
            activeTab === "basic" ? "text-white" : "text-gray-700"
          }`}
          onClick={() => setActiveTab("basic")}
        >
          Basic Search
        </button>
      </div>

      {/* AI Search Tab */}
      {activeTab === "ai" && (
        <div className="w-full max-w-3xl flex flex-col items-center">
          <textarea
            className="w-full p-4 rounded-lg border border-gray-300 focus:border-primary focus:ring focus:ring-primary/30 mb-4"
            placeholder="Ask about USC Entrepreneurship Resources..."
            rows={4}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {["Freshman interested in edtech", "Robotics startup idea", "Funding resources"].map(
              (q) => (
                <button
                  key={q}
                  className="px-3 py-1 rounded-full bg-primary text-white text-sm hover:bg-primary/80"
                >
                  {q}
                </button>
              )
            )}
          </div>
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
