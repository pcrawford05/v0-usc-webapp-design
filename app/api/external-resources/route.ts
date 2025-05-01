import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"

export async function GET() {
  try {
    const response = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/External%20Entrepreneurship%20Resources%20199dbf52cd2c809eb16ed46a1c42ec1e_all-N2h1KN12c0o9MtqOIUH6ZUJ15P42rZ.csv",
    )
    const csvText = await response.text()

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
    })

    // Group by Resource Type
    const groupedResources = records.reduce((acc: any, resource: any) => {
      if (!resource["Resource Type"]) return acc

      // Filter out resources with URLs as names
      if (
        !resource.Name ||
        resource.Name.toLowerCase().includes("http") ||
        resource.Name.toLowerCase().includes("www.") ||
        resource.Name.toLowerCase().includes(".com") ||
        resource.Name.toLowerCase().includes(".org") ||
        resource.Name.toLowerCase().includes(".edu")
      ) {
        return acc
      }

      if (!acc[resource["Resource Type"]]) {
        acc[resource["Resource Type"]] = []
      }

      acc[resource["Resource Type"]].push({
        name: resource.Name,
        description: resource.Description,
        link: resource.Link,
      })

      return acc
    }, {})

    // Convert to array format
    const formattedResources = Object.entries(groupedResources).map(([resourceType, items]) => ({
      resourceType,
      items,
    }))

    return NextResponse.json(formattedResources)
  } catch (error) {
    console.error("Error processing CSV:", error)
    return NextResponse.json({ error: "Failed to process resources" }, { status: 500 })
  }
}
