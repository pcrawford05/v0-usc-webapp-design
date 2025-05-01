"use client"

import type React from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { ChevronLeft, Star } from "lucide-react"
import { useEffect, useState, useRef, Suspense } from "react"
import { SearchBar, type SearchParams } from "@/components/search-bar"
import { useLocalStorage } from "@/lib/use-local-storage"

interface Resource {
  name: string
  description: string
  link: string
}

interface ResourceGroup {
  resourceType: string
  items: Resource[]
}

// Separate component for search functionality to be wrapped in Suspense
function ResourceSearchBar({
  onSearch,
  categories,
}: { onSearch: (params: SearchParams) => void; categories: string[] }) {
  return <SearchBar onSearch={onSearch} categories={categories} />
}

export default function ExternalResources() {
  const [resources, setResources] = useState<ResourceGroup[]>([])
  const [filteredResources, setFilteredResources] = useState<ResourceGroup[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  const [favorites, setFavorites] = useLocalStorage<string[]>("favorites", [])
  const accordionRef = useRef<HTMLDivElement>(null)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const [lastSearchParams, setLastSearchParams] = useState<SearchParams>({ query: "", category: "all" })

  useEffect(() => {
    async function fetchResources() {
      try {
        const response = await fetch("/api/external-resources")
        if (!response.ok) throw new Error("Failed to fetch resources")
        const data = await response.json()

        setResources(data)
        setFilteredResources(data)
        setCategories(data.map((group: ResourceGroup) => group.resourceType))
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchResources()
  }, [])

  useEffect(() => {
    if (openCategory && accordionRef.current) {
      // Give a small delay to allow the accordion to expand
      setTimeout(() => {
        const element = document.querySelector(`[data-category="${openCategory}"]`)
        if (element && searchBarRef.current) {
          const searchBarBottom = searchBarRef.current.getBoundingClientRect().bottom
          const elementTop = element.getBoundingClientRect().top

          // Calculate the scroll position to place the element just below the search bar
          const scrollOffset = elementTop - searchBarBottom - 20

          // Smooth scroll
          window.scrollBy({
            top: scrollOffset,
            behavior: "smooth",
          })
        }
      }, 100)
    }
  }, [openCategory])

  const handleSearch = ({ query, category }: SearchParams) => {
    // If category changed from a value to "all", close all accordions
    if (lastSearchParams.category !== "all" && category === "all") {
      setOpenCategory(null)
    }

    // If category changed to a specific value, open that accordion
    if (category !== "all" && category !== lastSearchParams.category) {
      // Check resourceType before calling toLowerCase
      const matchingCategory = resources.find(
        (group) => group.resourceType && typeof group.resourceType === 'string' && group.resourceType.toLowerCase() === category.toLowerCase()
      )?.resourceType; // Keep using resourceType here as API provides it

      if (matchingCategory) {
        setOpenCategory(matchingCategory)
      }
    }

    setLastSearchParams({ query, category })

    let filtered = [...resources]

    if (query) {
      const lowerQuery = query.toLowerCase(); // Convert query once
      filtered = filtered
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (resource) =>
              // Check name before toLowerCase
              (resource.name && typeof resource.name === 'string' && resource.name.toLowerCase().includes(lowerQuery)) ||
              // Check description before toLowerCase
              (resource.description && typeof resource.description === 'string' && resource.description.toLowerCase().includes(lowerQuery))
          ),
        }))
        .filter((group) => group.items.length > 0);
    }

    if (category && category !== "all") {
      const lowerCategory = category.toLowerCase(); // Convert category once
      filtered = filtered.filter(
        (group) =>
          // Check resourceType before toLowerCase
          group.resourceType && typeof group.resourceType === 'string' && group.resourceType.toLowerCase() === lowerCategory
      );
    }

    setFilteredResources(filtered)
  }

  const toggleFavorite = (resourceName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setFavorites((prev) => {
      if (prev.includes(resourceName)) {
        return prev.filter((name) => name !== resourceName)
      } else {
        return [...prev, resourceName]
      }
    })
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 md:p-12 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Link href="/" className="mt-4 inline-flex items-center text-primary hover:text-primary/80 transition-colors">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-6 md:p-12 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="flex items-center text-primary hover:text-primary/80 transition-colors">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">External Resources</h1>
          <p className="text-lg text-muted-foreground">
            Explore entrepreneurship resources from the greater Los Angeles ecosystem
          </p>
        </div>

        <div ref={searchBarRef} className="mb-8 sticky top-0 z-20 bg-white pt-4 pb-2">
          <Suspense fallback={<div className="h-40 bg-gray-100 animate-pulse rounded-lg"></div>}>
            <ResourceSearchBar onSearch={handleSearch} categories={categories} />
          </Suspense>
        </div>

        <div ref={accordionRef}>
          <Accordion
            type="single"
            collapsible
            className="space-y-4"
            value={openCategory || undefined}
            onValueChange={(value) => {
              if (value === openCategory) {
                setOpenCategory(null)
              } else {
                setOpenCategory(value)
              }
            }}
          >
            {filteredResources.map((group, index) => (
              <AccordionItem
                key={group.resourceType}
                value={group.resourceType}
                className={`bg-white rounded-lg border overflow-hidden ${
                  lastSearchParams.category === "all" && index % 2 === 0 ? "bg-primary/5" : ""
                }`}
                data-category={group.resourceType}
              >
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center">
                    <span className="text-xl font-semibold">{group.resourceType}</span>
                    <span className="ml-3 text-sm text-muted-foreground">({group.items.length} resources)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="grid gap-4 md:grid-cols-2 pt-2">
                    {group.items.map((resource) => (
                      <Link
                        key={resource.name}
                        href={resource.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-secondary hover:-translate-y-0.5 relative">
                          <div className="p-6">
                            <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                              {resource.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">{resource.description}</p>
                            <button
                              className="absolute bottom-3 right-3 p-1 rounded-full transition-colors z-10"
                              onClick={(e) => toggleFavorite(resource.name, e)}
                              aria-label={
                                favorites.includes(resource.name) ? "Remove from favorites" : "Add to favorites"
                              }
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
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </main>
  )
}
