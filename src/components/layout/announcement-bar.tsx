import { Megaphone } from "lucide-react";
import { getAnnouncements } from "@/lib/content";

export async function AnnouncementBar() {
  const items = await getAnnouncements();
  if (!items.length) return null;
  const a = items[0];
  return (
    <div className="relative z-50 bg-accent/90 px-4 py-2 text-center text-sm font-medium text-white">
      <Megaphone className="mr-2 inline size-4 -translate-y-px" />
      {a.link ? (
        <a href={a.link} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
          {a.message}
        </a>
      ) : (
        a.message
      )}
    </div>
  );
}
