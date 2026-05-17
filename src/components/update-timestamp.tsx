import { timestampTimeLabel } from "@/lib/date-label";

export function UpdateTimestamp({ generated }: { generated?: string | null }) {
  const label = generated ? timestampTimeLabel(generated) : null;

  return (
    <div className="update-timestamp" title={generated ?? undefined}>
      {label ? `LAST UPDATED: ${label}` : "LAST UPDATED: PENDING"}
    </div>
  );
}
