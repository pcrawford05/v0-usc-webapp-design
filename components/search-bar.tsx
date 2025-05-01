"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { useSearchParams as useNextSearchParams } from "next/navigation"

export interface SearchParams {
  query: string
  category: string
  type?: "internal" | "external" | "all"
}

export interface SearchBarProps {
  onSearch: (searchParams: SearchParams) => void
  categories: string[]
  showTypeFilter?: boolean
}

export function SearchBar({ onSearch, categories, showTypeFilter = false }: SearchBarProps) {
  const nextSearchParams = useNextSearchParams()
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: "",
    category: "all",
    type: "all",
  })

  // Initialize from URL params if available
  useEffect(() => {
    const query = nextSearchParams?.get("query") || ""
    const category = nextSearchParams?.get("category") || "all"
    const type = (nextSearchParams?.get("type") as "internal" | "external" | "all") || "all"

    if (query || category !== "all" || type !== "all") {
      const newParams = { query, category, type }
      setSearchParams(newParams)
      onSearch(newParams)
    }
  }, [nextSearchParams, onSearch])

  const handleChange = (field: keyof SearchParams, value: string) => {
    const newParams = { ...searchParams, [field]: value }
    setSearchParams(newParams)
    onSearch(newParams)
  }

  return (
    <div className="space-y-3 bg-white p-3 rounded-lg border shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="search">Search Resources</Label>
        <Input
          id="search"
          placeholder="Search by name or description..."
          value={searchParams.query}
          onChange={(e) => handleChange("query", e.target.value)}
          className="w-full"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={searchParams.category} onValueChange={(value) => handleChange("category", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
                {categories
                  .filter((category): category is string => typeof category === 'string') // Keep this filter
                  .map((category) => (
                    <SelectItem key={category} value={category.toLowerCase()}>
                      {category}
                    </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {showTypeFilter && (
          <div className="space-y-1.5">
            <Label>Resource Type</Label>
            <Select
              value={searchParams.type}
              onValueChange={(value) => handleChange("type", value as "internal" | "external" | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
