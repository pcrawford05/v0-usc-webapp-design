import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse, QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints";

// Initialize Notion Client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Your Database ID
const DATABASE_ID = "1c0dbf52cd2c808db635d801850b90d8"; // Replace if needed

// Helper function (can be shared if refactored, but included here for completeness)
function getPlainText(property: any): string | null {
  if (!property) return null;
  if (property.type === "title" && property.title?.length > 0) {
    return property.title[0]?.plain_text ?? null;
  }
  if (property.type === "rich_text" && property.rich_text?.length > 0) {
    return property.rich_text[0]?.plain_text ?? null;
  }
  if (property.type === "select" && property.select) {
    return property.select.name ?? null;
  }
   if (property.type === "url" && property.url) {
    return property.url;
  }
   if (property.type === "date" && property.date) {
    return property.date.start ?? null; // Or handle start/end as needed
  }
  // Add other property types if needed
  return null;
}


export async function GET() {
  // Basic check for environment variables
  if (!process.env.NOTION_API_KEY) {
    console.error("Missing NOTION_API_KEY environment variable");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (!DATABASE_ID) {
    console.error("Missing DATABASE_ID");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const queryParams: QueryDatabaseParameters = {
      database_id: DATABASE_ID,
      filter: {
        // Filter for External resources using the 'USC/External' property
        property: "USC/External", // <<< CONFIRM THIS PROPERTY NAME IS EXACT
        select: {
          equals: "External", // <<< Filter value changed to "External"
        },
      },
      // Add pagination logic here if needed for > 100 resources
      page_size: 100,
    };

    console.log("Querying Notion database for External Resources:", DATABASE_ID);
    const response = await notion.databases.query(queryParams);
    console.log(`Found ${response.results.length} External results from Notion.`);

    // Process Notion results
    const resources = response.results
     .map((page) => {
        if (!("properties" in page)) {
            return null;
        }
        const { properties } = page as PageObjectResponse;

        // --- Adjust property names here to EXACTLY match your Notion database ---
        // --- Mapping only properties needed for External resources ---
        const name = getPlainText(properties["Name"]); // Assumes 'Name' is Title type
        const description = getPlainText(properties["Description"]); // Assumes 'Description' is Rich Text
        const link = getPlainText(properties["Link"]); // Assumes 'Link' is URL type
        const resourceType = getPlainText(properties["Resource Type"]); // Assumes 'Resource Type' is Select type

        // Basic validation - skip if essential fields are missing
        if (!name || !resourceType) {
           console.warn("Skipping External resource due to missing name or resource type:", page.id);
           return null;
        }

        return {
          name,
          description: description ?? "",
          link: link ?? "#",
          resourceType, // Used for grouping
        };
      })
     .filter((resource): resource is NonNullable<typeof resource> => resource !== null);


    console.log(`Processed ${resources.length} valid External resources.`);

    // Group by Resource Type (as requested)
    const groupedResources = resources.reduce<Record<string, Array<typeof resources[0]>>>((acc, resource) => {
        const key = resource.resourceType;
        if (!acc[key]) {
        acc[key] = [];
        }
        acc[key].push(resource);
        return acc;
    }, {});

    // Convert to array format
    const formattedResources = Object.entries(groupedResources).map(([resourceType, items]) => ({
      resourceType,
      items,
    }));

    console.log("Returning formatted External resources:", formattedResources.length, "groups");
    return NextResponse.json(formattedResources);

  } catch (error: any) {
    console.error("Error fetching or processing External Notion data:", error);
    let errorMessage = "Failed to fetch resources";
     if (error.code === 'object_not_found') {
        errorMessage = "Database not found or integration lacks access.";
    } else if (error.body) {
        errorMessage = `Notion API Error: ${error.body}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}