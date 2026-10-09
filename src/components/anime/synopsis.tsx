"use client";

import { useState } from "react";

export function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320;
  return (
    <div>
      <p className={`whitespace-pre-line text-sm leading-relaxed text-fg/80 md:text-[15px] ${!open && long ? "line-clamp-3" : ""}`}>
        {text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-sm font-semibold text-accent hover:underline">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
