"use client"

// Temporary redirect page to preserve old URL; relies on next.config redirect but adds client fallback
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function BasicSearchLegacyRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/?tab=basic")
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to updated home...</p>
    </div>
  )
}