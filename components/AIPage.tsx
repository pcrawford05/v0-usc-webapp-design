"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Resource {
  name: string
  description: string
  resourceType: string
  type: "internal" | "external"
  link: string
  eligibility?: string
  importantDates?: string
}

export function AIPage({ resources }: { resources: Resource[] }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Resource[]>([])
  const [loading, setLoading] = useState(false)

  const exampleQueries = [
    "Freshman interested in edtech",
    "My idea is a robotics manufacturing company",
    "Looking for external startup mentorship programs",
    "Resources for USC students building AI products",
  ]

  const handleSubmit = async () => {
    if (!query) return
    setLoading(true)
    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      setResults(data.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setQuery(example)
    setTimeout(handleSubmit, 100)
  }

  return (
    <div className="flex flex-col items-center w-full max-w-3xl">
      <h2 className="text-2xl font-bold text-center text-primary mb-4">AI-Powered Search</h2>

      <div className="flex w-full mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something about USC Entrepreneurship resources..."
          className="flex-1 mr-2"
        />
        <Button onClick={handleSubmit} className="bg-red-900 hover:bg-red-800 text-white">
          Search
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {exampleQueries.map((ex) => (
          <Button
            key={ex}
            variant="outline"
            size="sm"
            onClick={() => handleExampleClick(ex)}
            className="border-red-900 text-red-900 hover:bg-red-100"
          >
            {ex}
          </Button>
        ))}
      </div>

      {loading && <p className="text-muted-foreground">Searching...</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {results.map((res) => (
            <Card key={res.name} className="p-4 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg text-primary mb-1">{res.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{res.description}</p>
              <p className="text-xs text-secondary-foreground mb-2">{res.resourceType}</p>
              <a
                href={res.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-900 hover:underline text-sm"
              >
                Visit Resource
              </a>
            </Card>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <p className="text-center text-muted-foreground mt-4">No results found for "{query}"</p>
      )}
    </div>
  )
}
