import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col items-center">
      <Skeleton className="h-12 w-64 mb-8" />

      <div className="w-full max-w-3xl mb-8">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
