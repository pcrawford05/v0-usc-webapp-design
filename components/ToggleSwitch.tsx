// components/ToggleSwitch.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

export default function ToggleSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const isAI = pathname.includes("ai-search");

  return (
    <div className="relative w-64 h-12 bg-gray-200 rounded-full flex">
      {/* sliding highlight */}
      <div
        className={clsx(
          "absolute top-0 left-0 w-1/2 h-full bg-primary rounded-full transition-transform duration-300",
          isAI ? "translate-x-0" : "translate-x-full"
        )}
      />
      {/* buttons */}
      <button
        className="relative z-10 flex-1 text-center font-semibold text-white"
        onClick={() => router.push("/ai-search")}
      >
        AI Search
      </button>
      <button
        className="relative z-10 flex-1 text-center font-semibold text-gray-800"
        onClick={() => router.push("/basic-search")}
      >
        Basic Search
      </button>
    </div>
  );
}
