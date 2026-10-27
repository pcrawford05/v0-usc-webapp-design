import type React from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { LaunchScreen } from "@/components/atlas/LaunchScreen"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Founder Compass",
  description: "Find your way through every USC entrepreneurship program: funding, competitions, mentorship, courses and more, with AI route planning.",
  metadataBase: new URL("https://v0-usc-webapp-design.vercel.app"),
  openGraph: {
    title: "Founder Compass",
    description: "Every USC entrepreneurship program in one place: funding, competitions, mentorship, courses and more.",
    images: [{ url: "/usc-startup-programs.png", width: 1700, height: 2200, alt: "USC entrepreneurship programs one-pager" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Founder Compass" },
  appleWebApp: { capable: true, title: "Compass", statusBarStyle: "default" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <a href="#main" className="sr-only z-[100] rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        <LaunchScreen />
        {children}
      </body>
    </html>
  )
}
