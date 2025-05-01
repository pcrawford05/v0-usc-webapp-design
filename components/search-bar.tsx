"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { useSearchParams as useNextSearchParams } from "next/navigation"
import { X } from "lucide-react" // Import the X icon
import { Button } from "@/components/ui/button" // Optional: Use Button component for consistent styling

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

  // Initialize from URL params if available (keep existing useEffect)
  useEffect(() => {
    const query = nextSearchParams?.get("query") || ""
    const category = nextSearchParams?.get("category") || "all"
    const type = (nextSearchParams?.get("type") as SearchParams["type"]) || "all" // Use type alias

    // Only update if URL params actually differ from initial state
    if (query || category !== "all" || (showTypeFilter && type !== "all")) {
       const initialParams = { query, category, type: showTypeFilter ? type : "all" };
       setSearchParams(initialParams);
       // Trigger initial search only if there are actual params in URL
       if (query || category !== "all" || type !== "all") {
         onSearch(initialParams);
       }
    } else {
       // Ensure state matches default if URL has no params
       setSearchParams({ query: "", category: "all", type: "all" });
    }
    // Removed onSearch from dependency array to avoid potential loops if parent passes unstable function
  }, [nextSearchParams, showTypeFilter]) // Re-run if showTypeFilter changes

  const handleChange = (field: keyof SearchParams, value: string) => {
    const newParams = { ...searchParams, [field]: value }
    setSearchParams(newParams)
    onSearch(newParams)
  }

  // --- New Clear Function ---
  const handleClear = () => {
    const clearedParams: SearchParams = {
      query: "",
      category: "all",
      type: "all",
    }
    setSearchParams(clearedParams)
    onSearch(clearedParams) // Notify parent page that search/filters are cleared
  }

  // --- Determine if Clear button should be visible ---
  const isClearable =
    searchParams.query !== "" ||
    searchParams.category !== "all" ||
    (showTypeFilter && searchParams.type !== "all")

  return (
    <div className="space-y-3 bg-white p-3 rounded-lg border shadow-sm">
      {/* Search Input Section */}
      <div className="space-y-1.5">
        <Label htmlFor="search">Search Resources</Label>
        {/* Wrap Input in a relative div for positioning the button */}
        <div className="relative flex items-center">
          <Input
            id="search"
            placeholder="Search by name or description..."
            value={searchParams.query}
            onChange={(e) => handleChange("query", e.target.value)}
            // Add padding to the right if clear button is visible to prevent text overlap
            className={`w-full ${isClearable ? 'pr-10' : ''}`}
          />
          {/* Conditionally render the Clear button */}
          {isClearable && (
             <Button // Using Button component for consistent styling and accessibility
              type="button"
              variant="ghost" // Use ghost variant for less emphasis
              size="sm" // Use small size
              className="absolute right-1 h-7 w-7 p-0" // Position inside on the right
              onClick={handleClear}
              aria-label="Clear search and filters"
            >
              <X className="h-4 w-4 text-muted-foreground" /> {/* Icon */}
            </Button>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className={`grid gap-3 ${showTypeFilter ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
        {/* Category Select */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={searchParams.category} onValueChange={(value) => handleChange("category", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories
                .filter((category): category is string => typeof category === 'string')
                .map((category) => (
                  <SelectItem key={category} value={category.toLowerCase()}>
                    {category}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resource Type Select (Conditional) */}
        {showTypeFilter && (
          <div className="space-y-1.5">
            <Label>Resource Type</Label>
            <Select
              value={searchParams.type ?? "all"}
              onValueChange={(value) => handleChange("type", value as SearchParams["type"])}
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