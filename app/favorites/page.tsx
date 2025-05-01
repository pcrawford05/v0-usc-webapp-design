"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import Link from "next/link"
import { ChevronLeft, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocalStorage } from "@/lib/use-local-storage"

interface FavoriteResource {
  name: string
  description: string
  link: string
  type: "internal" | "external"
  category: string
}

export default function Favorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>("favorites", [])
  const [favoriteResources, setFavoriteResources] = useState<FavoriteResource[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const removeFavorite = (resourceName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFavorites((prev) => {
      const newFavorites = prev.filter((name) => name !== resourceName)
      return newFavorites
    })
  }

  useEffect(() => {
    async function fetchFavoriteResources() {
      try {
        const [internalRes, externalRes] = await Promise.all([
          fetch("/api/internal-resources"),
          fetch("/api/external-resources"),
        ])

        const internalData = await internalRes.json()
        const externalData = await externalRes.json()

        // Process internal resources
        const internalResources = internalData.flatMap((group: any) =>
          group.items
            .filter((item: any) => favorites.includes(item.name))
            .map((item: any) => ({
              name: item.name,
              description: item.description,
              link: item.link || "#",
              type: "internal" as const,
              category: group.category,
            })),
        )

        // Process external resources
        const externalResources = externalData.flatMap((group: any) =>
          group.items
            .filter((item: any) => favorites.includes(item.name))
            .map((item: any) => ({
              name: item.name,
              description: item.description,
              link: item.link,
              type: "external" as const,
              category: group.resourceType,
            })),
        )

        setFavoriteResources([...internalResources, ...externalResources])
      } catch (error) {
        console.error("Error fetching resources:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFavoriteResources()
  }, [favorites])

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
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">Favorites</h1>
          <p className="text-lg text-muted-foreground">Your collection of favorite entrepreneurship resources</p>
        </div>

        {favoriteResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteResources.map((resource) => (
              <Link
                key={resource.name}
                href={resource.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-secondary hover:-translate-y-0.5 relative">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{resource.name}</h3>
                      <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">
                        {resource.type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                    <div className="flex items-center justify-start text-xs text-muted-foreground mt-2">
                      <span>{resource.category}</span>
                    </div>
                    <button
                      className="absolute bottom-3 right-3 p-1 rounded-full transition-colors z-10"
                      onClick={(e) => removeFavorite(resource.name, e)}
                      aria-label="Remove from favorites"
                    >
                      <Star className="h-5 w-5 fill-secondary text-secondary hover:fill-primary hover:text-primary transition-all" />
                    </button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Star className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No favorites yet</h2>
            <p className="text-muted-foreground max-w-md">
              Your favorite resources will be stored here. Click the star icon on any resource to add it to your
              favorites.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
