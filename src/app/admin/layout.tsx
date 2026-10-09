import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/reports", "Reports"],
  ["/admin/content", "Content"],
  ["/admin/announcements", "Announcements"],
  ["/admin/audit", "Audit log"],
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Non-admins get a 404 so the panel's existence isn't revealed.
  if (!(await isAdmin())) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Admin</h1>
      <nav className="no-scrollbar mt-4 flex gap-1 overflow-x-auto border-b border-line pb-3">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-elev hover:text-fg">
            {label}
          </Link>
        ))}
      </nav>
      <div className="py-6">{children}</div>
    </div>
  );
}
