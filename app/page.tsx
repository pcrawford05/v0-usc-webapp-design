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
  category: string
  type: "internal" | "external"
  link: string
}

// Separate component for search functionality to be wrapped in Suspense
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
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    async function fetchAllResources() {
      try {
        const [internalRes, externalRes] = await Promise.all([
          fetch("/api/internal-resources"),
          fetch("/api/external-resources"),
        ])

        const internalData = await internalRes.json()
        const externalData = await externalRes.json()

        // Process and filter internal resources
        const internalResources = internalData.flatMap((group: any) =>
          group.items
            .filter((item: any) => {
              // Filter out resources with URLs as names or empty descriptions
              return (
                item.name &&
                !item.name.toLowerCase().includes("http") &&
                !item.name.toLowerCase().includes("www.") &&
                !item.name.toLowerCase().includes(".com") &&
                !item.name.toLowerCase().includes(".org") &&
                !item.name.toLowerCase().includes(".edu") &&
                item.description &&
                item.description.trim() !== ""
              )
            })
            .map((item: any) => ({
              ...item,
              category: group.category,
              type: "internal" as const,
            })),
        )

        // Process and filter external resources
        const externalResources = externalData.flatMap((group: any) =>
          group.items
            .filter((item: any) => {
              // Filter out resources with URLs as names or empty descriptions
              return (
                item.name &&
                !item.name.toLowerCase().includes("http") &&
                !item.name.toLowerCase().includes("www.") &&
                !item.name.toLowerCase().includes(".com") &&
                !item.name.toLowerCase().includes(".org") &&
                !item.name.toLowerCase().includes(".edu") &&
                item.description &&
                item.description.trim() !== ""
              )
            })
            .map((item: any) => ({
              ...item,
              category: group.resourceType,
              type: "external" as const,
            })),
        )

        const allResources = [...internalResources, ...externalResources]
        const uniqueCategories = Array.from(new Set(allResources.map((r) => r.category)))

        setResources(allResources)
        setCategories(uniqueCategories)
      } catch (error) {
        console.error("Error fetching resources:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllResources()
  }, [])

  useEffect(() => {
    const storedFavorites = localStorage.getItem("favorites")
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites))
    }
  }, [])

  const handleSearch = ({ query, category, type }: SearchParams) => {
    let filtered = resources

    const isSearchActive = query || (category && category !== "all") || (type && type !== "all")
    setIsSearching(isSearchActive)

    if (query) {
      const searchQuery = query.toLowerCase()
      filtered = filtered.filter(
        (resource) =>
          resource.name.toLowerCase().includes(searchQuery) || resource.description.toLowerCase().includes(searchQuery),
      )
    }

    if (category && category !== "all") {
      filtered = filtered.filter((resource) => resource.category.toLowerCase() === category.toLowerCase())
    }

    if (type && type !== "all") {
      filtered = filtered.filter((resource) => resource.type === type)
    }

    setFilteredResources(filtered)
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-6 pb-16">
      <h1 className="text-3xl md:text-5xl font-bold text-center mb-4 text-primary">USC Entrepreneurship Resources</h1>

      <Suspense fallback={<div className="w-full max-w-3xl mb-4 h-40 bg-gray-100 animate-pulse rounded-lg"></div>}>
        <ResourceSearch onSearch={handleSearch} categories={categories} showTypeFilter={true} />
      </Suspense>

      {!isSearching ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl mb-16">
          <Link
            href="/internal-resources"
            className="group relative overflow-hidden rounded-2xl aspect-[16/9] shadow-lg hover:shadow-xl transition-all duration-500 mb-4 md:mb-0"
          >
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-3ENBMsRnXH8lODgsfoNvUPDrSAX3S2.png"
              alt="USC Campus with Tommy Trojan statue"
              fill
              className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
            <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-500 group-hover:translate-y-[-4px]">
              <h2 className="text-xl md:text-2xl font-bold text-white">Internal Resources</h2>
            </div>
          </Link>
          <Link
            href="/external-resources"
            className="group relative overflow-hidden rounded-2xl aspect-[16/9] shadow-lg hover:shadow-xl transition-all duration-500 mb-4 md:mb-0"
          >
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-6UvMPZwjJ4vX0T5SGZzF6pgvPuNn2m.png"
              alt="Los Angeles Skyline at sunset"
              fill
              className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
            <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-500 group-hover:translate-y-[-4px]">
              <h2 className="text-xl md:text-2xl font-bold text-white">External Resources</h2>
            </div>
          </Link>
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
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{resource.name}</h3>
                      <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                        {resource.type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
                    <div className="flex items-center justify-start text-xs text-muted-foreground mt-2">
                      <span>{resource.category}</span>
                    </div>
                    <button
                      className="absolute bottom-3 right-3 p-1 rounded-full transition-colors z-10"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const newFavorites = favorites.includes(resource.name)
                          ? favorites.filter((name) => name !== resource.name)
                          : [...favorites, resource.name]
                        localStorage.setItem("favorites", JSON.stringify(newFavorites))
                        setFavorites(newFavorites)
                      }}
                      aria-label={favorites.includes(resource.name) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star
                        className={`h-5 w-5 ${
                          favorites.includes(resource.name)
                            ? "fill-secondary text-secondary"
                            : "text-primary hover:fill-primary"
                        } transition-all`}
                      />
                    </button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {filteredResources.length === 0 && (
            <div className="text-center py-8">
              <p className="text-lg text-muted-foreground">No resources found matching your search criteria.</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
