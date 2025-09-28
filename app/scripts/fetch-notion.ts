import fs from "fs";
import fetch from "node-fetch";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const notionToken = process.env.NOTION_API_KEY;
const databaseId = process.env.NOTION_DATABASE_ID;

if (!notionToken || !databaseId) {
  console.error("❌ Missing NOTION_API_KEY or NOTION_DATABASE_ID");
  process.exit(1);
}

// Type definitions for Notion API responses
interface NotionRichText {
  plain_text: string;
}

interface NotionTitleProperty {
  title: NotionRichText[];
}

interface NotionSelectProperty {
  select: {
    name: string;
  } | null;
}

interface NotionRichTextProperty {
  rich_text: NotionRichText[];
}

interface NotionUrlProperty {
  url: string | null;
}

interface NotionDateProperty {
  date: {
    start: string;
  } | null;
}

interface NotionPageProperties {
  Name: NotionTitleProperty;
  "Resource Type": NotionSelectProperty;
  "USC/External": NotionSelectProperty;
  Description: NotionRichTextProperty;
  Eligibility: NotionRichTextProperty;
  Link: NotionUrlProperty;
  "Important Dates": NotionDateProperty;
}

interface NotionPage {
  id: string;
  last_edited_time: string;
  properties: NotionPageProperties;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface ProcessedResource {
  id: string;
  last_edited_time: string;
  name: string;
  resourceType: string | null;
  uscExternal: string | null;
  description: string | null;
  eligibility: string | null;
  link: string | null;
  importantDates: string | null;
}

// Safely extract plain text from Notion rich_text/array fields
function getText(obj: NotionRichText[] | undefined | null): string | null {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    return obj.map((t: NotionRichText) => t.plain_text).join(" ");
  }
  return null;
}

async function fetchDatabase(): Promise<ProcessedResource[]> {
  let results: NotionPage[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(startCursor ? { start_cursor: startCursor } : {}),
    });

    if (!res.ok) {
      console.error("❌ Error fetching Notion:", await res.text());
      process.exit(1);
    }

    const data = await res.json() as NotionQueryResponse;
    results = results.concat(data.results);

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  return results.map((page: NotionPage): ProcessedResource => {
    const props = page.properties;

    return {
      id: page.id,
      last_edited_time: page.last_edited_time,
      name: props["Name"]?.title?.map((t: NotionRichText) => t.plain_text).join(" ") || "",
      resourceType: props["Resource Type"]?.select?.name || null,
      uscExternal: props["USC/External"]?.select?.name || null,
      description: getText(props["Description"]?.rich_text) || null,
      eligibility: getText(props["Eligibility"]?.rich_text) || null,
      link: props["Link"]?.url || null,
      importantDates: props["Important Dates"]?.date?.start || null,
    };
  });
}

(async () => {
  try {
    console.log("🚀 Fetching Notion database...");
    const pages = await fetchDatabase();
    
    // Ensure data directory exists
    if (!fs.existsSync("data")) {
      fs.mkdirSync("data", { recursive: true });
      console.log("📁 Created data directory");
    }
    
    // Write the JSON file
    fs.writeFileSync("data/notion-data.json", JSON.stringify(pages, null, 2));
    console.log(`✅ Saved ${pages.length} resources → data/notion-data.json`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
})();
