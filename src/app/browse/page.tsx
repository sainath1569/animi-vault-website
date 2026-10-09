import type { Metadata } from "next";
import { BrowseView } from "@/components/browse/browse-view";

export const metadata: Metadata = { title: "Browse Anime" };

export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return <BrowseView searchParams={await searchParams} title="Browse" />;
}
