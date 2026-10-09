import type { Metadata } from "next";
import { Suspense } from "react";
import { ListView } from "./list-view";

export const metadata: Metadata = { title: "My List" };

export default function ListPage() {
  return (
    <Suspense>
      <ListView />
    </Suspense>
  );
}
