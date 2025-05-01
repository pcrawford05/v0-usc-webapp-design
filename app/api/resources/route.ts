import { NextResponse } from "next/server"
import { parse } from "csv-parse/sync"

export async function GET() {
  try {
    const response = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/USC%20Entrepreneurship%20Resources%2018cdbf52cd2c804b864dfa1355926b0b-HR4OLDQxz9AMfe0acFMMVmpLUDRjWK.csv",
    )
    const csvText = await response.text()

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
    })

    // Group by Category
    const groupedResources = records.reduce((acc: any, resource: any) => {
      if (!resource.Category) return acc

      if (!acc[resource.Category]) {
        acc[resource.Category] = []
      }

      acc[resource.Category].push({
        name: resource.Name,
        description: resource.Description,
        eligibility: resource.Eligibility,
        link: resource.Link,
        importantDates: resource["Important Dates"],
        stage: resource.Stage,
        parentItem: resource["Parent item"],
        subItem: resource["Sub-item"],
      })

      return acc
    }, {})

    // Convert to array format
    const formattedResources = Object.entries(groupedResources).map(([category, items]) => ({
      category,
      items,
    }))

    return NextResponse.json(formattedResources)
  } catch (error) {
    console.error("Error processing CSV:", error)
    return NextResponse.json({ error: "Failed to process resources" }, { status: 500 })
  }
}
