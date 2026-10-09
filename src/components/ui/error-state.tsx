import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <AlertTriangle className="size-10 text-warn" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      {icon && <div className="text-dim">{icon}</div>}
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
