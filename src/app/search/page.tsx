import type { Metadata } from "next";
import { BrowseView } from "@/components/browse/browse-view";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: q ? `Search: ${Array.isArray(q) ? q[0] : q}` : "Search" };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  return <BrowseView searchParams={await searchParams} title="Search" />;
}
