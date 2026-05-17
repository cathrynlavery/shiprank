import { timestampLabel } from "@/lib/date-label";

export function UpdateTimestamp({ generated }: { generated?: string | null }) {
  const label = generated ? timestampLabel(generated) : null;

  return (
    <div className="update-timestamp" title={generated ?? undefined}>
      {label ? `Last updated ${label}` : "Stats pending"}
    </div>
  );
}
