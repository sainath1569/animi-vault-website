"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  href?: string;
  children: ReactNode;
  /** Tailwind width classes for each slide. */
  itemClassName?: string;
  action?: ReactNode;
}

/** Horizontally scrolling row with snap on touch and arrow buttons on desktop. */
export function Row({ title, href, children, itemClassName, action }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function scroll(dir: 1 | -1) {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const items = Array.isArray(children) ? children : [children];

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-end justify-between gap-4 px-4 md:px-8">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight md:text-xl">
          {href ? (
            <Link href={href} className="hover:text-accent">
              {title} <ChevronRight className="inline size-5 -translate-y-px text-dim" />
            </Link>
          ) : (
            title
          )}
        </h2>
        {action}
      </div>
      <div className="relative">
        <div
          ref={ref}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 md:scroll-px-8 md:gap-4 md:px-8"
        >
          {items.map((child, i) => (
            <div
              key={i}
              className={cn("w-[38vw] shrink-0 snap-start sm:w-[28vw] md:w-[19vw] lg:w-[15vw] xl:w-[12.5vw] 2xl:w-[11vw] max-w-[210px]", itemClassName)}
            >
              {child}
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
          className={cn(
            "absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-bg to-transparent opacity-0 transition-opacity md:flex",
            !edges.start && "group-hover/row:opacity-100",
          )}
          tabIndex={-1}
        >
          <ChevronLeft className="size-8" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scroll(1)}
          className={cn(
            "absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-bg to-transparent opacity-0 transition-opacity md:flex",
            !edges.end && "group-hover/row:opacity-100",
          )}
          tabIndex={-1}
        >
          <ChevronRight className="size-8" />
        </button>
      </div>
    </section>
  );
}
