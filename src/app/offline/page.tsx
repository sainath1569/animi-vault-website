import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-28 text-center">
      <WifiOff className="size-12 text-dim" />
      <h1 className="mt-4 text-xl font-semibold">You’re offline</h1>
      <p className="mt-2 text-sm text-muted">Reconnect to keep watching. Your progress is saved.</p>
    </div>
  );
}
