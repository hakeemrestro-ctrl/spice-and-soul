import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";

export const metadata = { title: "Gift Orders — Admin" };

type GiftOrder = {
  id: string;
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  message: string | null;
  redeemed_at: string | null;
  created_at: string;
  courses: { title: string } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function GiftOrdersPage() {
  const supabase = createAdminClient();

  const { data: gifts } = await supabase
    .from("gift_orders")
    .select("id, sender_email, sender_name, recipient_email, recipient_name, message, redeemed_at, created_at, courses(title)")
    .order("created_at", { ascending: false })
    .returns<GiftOrder[]>();

  const rows = gifts ?? [];
  const redeemed = rows.filter((g) => g.redeemed_at).length;

  return (
    <>
      <PageHeader
        title="Gift Orders"
        subtitle={`${rows.length} total · ${redeemed} redeemed`}
      />

      <DataTable
        cols={["Sender", "Recipient", "Course", "Message", "Redeemed", "Sent"]}
        emptyMessage="No gift orders yet."
        rows={rows.map((g) => [
          <div key="s">
            <div className="font-sans text-sm font-medium text-clove-700">{g.sender_name ?? "—"}</div>
            <div className="font-sans text-xs text-clove-400">{g.sender_email}</div>
          </div>,
          <div key="r">
            <div className="font-sans text-sm text-clove-700">{g.recipient_name ?? "—"}</div>
            <div className="font-sans text-xs text-clove-400">{g.recipient_email}</div>
          </div>,
          <span key="c" className="font-sans text-sm text-clove-600">
            {(g.courses as unknown as { title: string } | null)?.title ?? "—"}
          </span>,
          <p key="m" className="max-w-[160px] font-sans text-xs italic leading-relaxed text-clove-500 line-clamp-2">
            {g.message ?? <span className="not-italic text-clove-300">—</span>}
          </p>,
          g.redeemed_at ? (
            <span key="rd" className="font-sans text-xs text-cardamom-600">{formatDate(g.redeemed_at)}</span>
          ) : (
            <span key="rd" className="font-sans text-xs text-clove-300">Pending</span>
          ),
          <span key="d" className="font-sans text-xs text-clove-400">{formatDate(g.created_at)}</span>,
        ])}
      />
    </>
  );
}
