import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LaunchScreen } from "@/components/atlas/LaunchScreen"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Founder Compass",
  description: "Find your way through every USC entrepreneurship program: funding, competitions, mentorship, courses and more, with AI route planning.",
  appleWebApp: { capable: true, title: "Compass", statusBarStyle: "default" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LaunchScreen />
        {children}
      </body>
    </html>
  )
}
