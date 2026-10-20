/** Shares a link: the native share sheet on phones, the clipboard everywhere else. */
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  if (touch && navigator.share) {
    try {
      await navigator.share({ title, url })
      return "shared"
    } catch {
      /* dismissed: fall through to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return "copied"
  } catch {
    return "failed"
  }
}
