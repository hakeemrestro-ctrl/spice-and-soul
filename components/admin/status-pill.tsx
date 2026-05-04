import { Badge } from "@/components/ui/badge";

type Status =
  | "paid"
  | "refunded"
  | "pending"
  | "published"
  | "draft"
  | "bundle";

const VARIANT_MAP: Record<
  Status,
  { variant: "cardamom" | "paprikaSoft" | "saffronSoft" | "secondary"; label?: string }
> = {
  paid: { variant: "cardamom" },
  published: { variant: "cardamom" },
  refunded: { variant: "paprikaSoft" },
  pending: { variant: "secondary" },
  draft: { variant: "secondary" },
  bundle: { variant: "saffronSoft" },
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const conf = VARIANT_MAP[status] ?? VARIANT_MAP.pending;
  return (
    <Badge
      variant={conf.variant}
      className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]"
    >
      {label ?? status}
    </Badge>
  );
}
