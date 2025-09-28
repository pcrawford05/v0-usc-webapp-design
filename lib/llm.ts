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

type TextGenerationStreamEvent = {
  token?: {
    text?: string
    special?: boolean
  }
  generated_text?: string
}

type ChatCompletionStreamEvent = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ text?: string | null } | string | null | undefined>
    }
  }>
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

interface SummaryStreamCallbacks {
  onToken?: (token: string) => void
}

async function streamTextGeneration(
  model: string,
  prompt: string,
  onToken: (token: string) => void
): Promise<string | null> {
  const client = getHfClient()
  let collected = ""
  let hasContent = false

  for await (const event of client.textGenerationStream({
    model,
    inputs: prompt,
    parameters: {
      max_new_tokens: 400,
      temperature: 0.4,
      top_p: 0.95,
      return_full_text: false,
    },
  }) as AsyncGenerator<TextGenerationStreamEvent>) {
    if (event.generated_text && event.generated_text.length > collected.length) {
      const delta = event.generated_text.slice(collected.length)
      if (delta) {
        collected += delta
        hasContent = true
        onToken(delta)
      }
      continue
    }

    const tokenText = event.token?.text ?? ""
    if (!tokenText || event.token?.special) {
      continue
    }

    collected += tokenText
    hasContent = true
    onToken(tokenText)
  }

  const trimmed = collected.trim()
  return hasContent && trimmed.length > 0 ? trimmed : null
}

async function streamChatCompletion(
  model: string,
  prompt: string,
  onToken: (token: string) => void
): Promise<string | null> {
  const client = getHfClient()
  let collected = ""
  let hasContent = false

  for await (const chunk of client.chatCompletionStream({
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
  }) as AsyncGenerator<ChatCompletionStreamEvent>) {
    const content = chunk.choices?.[0]?.delta?.content

    if (!content) {
      continue
    }

    if (typeof content === "string") {
      if (content.length > 0) {
        collected += content
        hasContent = true
        onToken(content)
      }
      continue
    }

    if (Array.isArray(content)) {
      const text = content
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

      if (text.length > 0) {
        collected += text
        hasContent = true
        onToken(text)
      }
    }
  }

  const trimmed = collected.trim()
  return hasContent && trimmed.length > 0 ? trimmed : null
}

async function streamModel(
  model: string,
  prompt: string,
  onToken: (token: string) => void
): Promise<string | null> {
  try {
    const generated = await streamTextGeneration(model, prompt, onToken)
    if (generated) {
      return generated
    }
  } catch (error) {
    if (isConversationalOnlyError(error)) {
      const chatSummary = await streamChatCompletion(model, prompt, onToken)
      if (chatSummary) {
        return chatSummary
      }
      throw error
    }

    throw error
  }

  const chatSummary = await streamChatCompletion(model, prompt, onToken)
  if (chatSummary) {
    return chatSummary
  }

  return null
}

export async function streamSummary(
  query: string,
  items: SummaryItem[],
  callbacks: SummaryStreamCallbacks = {}
): Promise<string | null> {
  if (!query.trim() || items.length === 0) {
    return null
  }

  const onToken = callbacks.onToken ?? (() => {})
  const prompt = buildSummaryPrompt(query, items)
  const modelsToTry = SUMMARY_MODEL !== DEFAULT_SUMMARY_MODEL ? [SUMMARY_MODEL, DEFAULT_SUMMARY_MODEL] : [SUMMARY_MODEL]

  let lastError: unknown = null

  for (const model of modelsToTry) {
    let modelError: unknown = null
    let producedTokens = false

    const summary = await streamModel(
      model,
      prompt,
      token => {
        producedTokens = true
        onToken(token)
      }
    ).catch(error => {
      modelError = error
      return null
    })

    if (summary && summary.trim().length > 0) {
      return summary.trim()
    }

    if (modelError) {
      if (SUMMARY_MODEL !== DEFAULT_SUMMARY_MODEL && model === SUMMARY_MODEL) {
        if (isProviderUnavailableError(modelError)) {
          console.warn(
            `Requested summary model '${SUMMARY_MODEL}' is unavailable for streaming. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`,
            modelError
          )
        } else if (isConversationalOnlyError(modelError)) {
          console.warn(
            `Requested summary model '${SUMMARY_MODEL}' only supports conversational streaming. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`
          )
        } else {
          console.warn(
            `Requested summary model '${SUMMARY_MODEL}' failed while streaming. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`,
            modelError
          )
        }
      } else {
        lastError = modelError
      }

      if (producedTokens) {
        throw modelError
      }

      continue
    }

    if (SUMMARY_MODEL !== DEFAULT_SUMMARY_MODEL && model === SUMMARY_MODEL) {
      console.warn(
        `Requested summary model '${SUMMARY_MODEL}' returned no streaming content. Falling back to '${DEFAULT_SUMMARY_MODEL}'.`
      )
    }
  }

  if (lastError) {
    throw lastError
  }

  return null
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
