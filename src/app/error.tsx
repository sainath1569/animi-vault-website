"use client";

import { RotateCw } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-16">
      <ErrorState
        title="Something went wrong"
        message="One of our data sources is busy or unreachable. This usually clears up in a few seconds."
        action={
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <RotateCw className="size-4" /> Try again
          </button>
        }
      />
    </div>
  );
}
