import { Compass } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <main id="main" className="app-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#b3001b] to-[#7a0000] text-[#FFCC00]">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">This page is off the map</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The link may be old, or the program may have moved. Every USC program is still one click away.</p>
      <Link href="/" className="rounded-xl bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition hover:opacity-90">
        Back to Founder Compass
      </Link>
    </main>
  )
}
