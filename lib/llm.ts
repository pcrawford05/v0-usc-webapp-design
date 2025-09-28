import { getHfClient, type Resource } from "./embeddings"

export interface SummaryItem {
  resource: Resource
  score: number
}

const DEFAULT_SUMMARY_MODEL = "HuggingFaceH4/zephyr-7b-beta"
const SUMMARY_MODEL = process.env.HF_SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL

function buildSummaryPrompt(query: string, items: SummaryItem[]): string {
  const lines: string[] = [
    "You are an expert guide for USC entrepreneurship resources.",
    "A student asked the following question:",
    query.trim(),
    "",
    "You retrieved the top resources. For each resource, write 1-2 concise sentences summarizing what it offers and how it helps this student. Reference the resource by name at the start of each sentence.",
    "If you are unsure about a detail, omit it. Keep the tone encouraging and practical.",
    "Resources:",
  ]

  items.forEach((item, index) => {
    const { resource, score } = item
    const entry: string[] = [
      `${index + 1}. Name: ${resource.name}`,
      `   Match Score: ${(score * 100).toFixed(1)}%`,
    ]

    if (resource.description) {
      entry.push(`   Description: ${resource.description}`)
    }

    if (resource.eligibility) {
      entry.push(`   Eligibility: ${resource.eligibility}`)
    }

    if (resource.importantDates) {
      entry.push(`   Important Dates: ${resource.importantDates}`)
    }

    entry.push(`   Type: ${resource.type ?? "unknown"}`)

    if (resource.link && resource.link !== "#") {
      entry.push(`   Link: ${resource.link}`)
    }

    lines.push(entry.join("\n"))
  })

  lines.push(
    "",
    "Respond with short paragraphs or bullet points.",
  )

  return lines.join("\n")
}

function isProviderUnavailableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "InputError" ||
      (typeof error.message === "string" && error.message.includes("No Inference Provider available")))
  )
}

function isConversationalOnlyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof error.message === "string" &&
    /supported task:\s*conversational/i.test(error.message)
  )
}

function extractGeneratedText(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload.trim()
  }

  if (payload && typeof payload === "object") {
    if (!Array.isArray(payload) && "generated_text" in payload) {
      const text = (payload as { generated_text?: string }).generated_text
      return text ? text.trim() : null
    }

    if (Array.isArray(payload) && payload.length > 0) {
      const text = (payload[0] as { generated_text?: string; output?: string })
      if (text?.generated_text) {
        return text.generated_text.trim()
      }
      if (text?.output) {
        return text.output.trim()
      }
    }
  }

  return null
}

async function runTextGeneration(model: string, prompt: string): Promise<string | null> {
  const client = getHfClient()
  const response = await client.textGeneration({
    model,
    inputs: prompt,
    parameters: {
      max_new_tokens: 400,
      temperature: 0.4,
      top_p: 0.95,
      return_full_text: false,
    },
  })

  return extractGeneratedText(response)
}

async function runChatCompletion(model: string, prompt: string): Promise<string | null> {
  const client = getHfClient()
  const response = await client.chatCompletion({
    model,
    messages: [
      {
        role: "system",
        content: "You are an expert guide for USC entrepreneurship resources who writes concise, encouraging summaries.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 400,
    temperature: 0.4,
    top_p: 0.95,
  })

  const choice = response.choices?.[0]
  const content = choice?.message?.content as unknown

  if (!content) {
    return null
  }

  if (typeof content === "string") {
    const trimmed = content.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (Array.isArray(content)) {
    const text = (content as Array<string | { text?: string } | null | undefined>)
      .map(part => {
        if (!part) {
          return ""
        }
        if (typeof part === "string") {
          return part
        }
        if (typeof part === "object" && typeof part.text === "string") {
          return part.text
        }
        return ""
      })
      .join("")
      .trim()

    return text.length > 0 ? text : null
  }

  return null
}

interface TryModelResult {
  summary: string | null
  error: unknown | null
}

async function tryModel(model: string, prompt: string): Promise<TryModelResult> {
  try {
    const generated = await runTextGeneration(model, prompt)
    if (generated) {
      return { summary: generated, error: null }
    }
  } catch (error) {
    if (isConversationalOnlyError(error)) {
      try {
        const chatSummary = await runChatCompletion(model, prompt)
        if (chatSummary) {
          return { summary: chatSummary, error: null }
        }
      } catch (chatError) {
        return { summary: null, error: chatError }
      }
    }

    return { summary: null, error }
  }

  try {
    const chatSummary = await runChatCompletion(model, prompt)
    if (chatSummary) {
      return { summary: chatSummary, error: null }
    }
  } catch (chatError) {
    return { summary: null, error: chatError }
  }

  return { summary: null, error: null }
}

export async function generateSummary(query: string, items: SummaryItem[]): Promise<string | null> {
  if (!query.trim() || items.length === 0) {
    return null
  }

  const prompt = buildSummaryPrompt(query, items)

  try {
    const { summary: primarySummary, error: primaryError } = await tryModel(SUMMARY_MODEL, prompt)

    if (primarySummary) {
      return primarySummary
    }

    if (SUMMARY_MODEL !== DEFAULT_SUMMARY_MODEL) {
      if (primaryError) {
        if (isProviderUnavailableError(primaryError)) {
          console.warn(
            `Requested summary model '${SUMMARY_MODEL}' is unavailable. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`,
            primaryError
          )
        } else if (isConversationalOnlyError(primaryError)) {
          console.warn(
            `Requested summary model '${SUMMARY_MODEL}' only supports conversational responses. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`
          )
        } else {
          console.warn(
            `Requested summary model '${SUMMARY_MODEL}' failed. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`,
            primaryError
          )
        }
      } else {
        console.warn(
          `Requested summary model '${SUMMARY_MODEL}' returned no content. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`
        )
      }

      const { summary: fallbackSummary, error: fallbackError } = await tryModel(DEFAULT_SUMMARY_MODEL, prompt)

      if (fallbackSummary) {
        return fallbackSummary
      }

      if (fallbackError) {
        console.warn("Default summary model also failed", fallbackError)
      }
    } else if (primaryError) {
      console.warn("Unable to generate LLM summary with the requested model", primaryError)
    }
  } catch (error) {
    console.warn("Unable to generate LLM summary with the requested model", error)
  }

  return null
}
