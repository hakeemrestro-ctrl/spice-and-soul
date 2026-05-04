import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";

export const metadata = { title: "Subscribers — Admin" };

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  sampler_sent_at: string | null;
  last_drip_step: number;
  unsubscribed_at: string | null;
  created_at: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function SubscribersPage() {
  const supabase = createAdminClient();

  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("id, email, name, source, sampler_sent_at, last_drip_step, unsubscribed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Subscriber[]>();

  const rows = subscribers ?? [];
  const active = rows.filter((s) => !s.unsubscribed_at).length;

  return (
    <>
      <PageHeader
        title="Subscribers"
        subtitle={`${rows.length} total · ${active} active`}
      />

      <DataTable
        cols={["Email", "Name", "Source", "Sampler", "Drip Step", "Subscribed", "Status"]}
        emptyMessage="No subscribers yet."
        rows={rows.map((s) => [
          <span key="e" className="font-sans text-sm text-clove-700">{s.email}</span>,
          <span key="n" className="font-sans text-sm text-clove-600">{s.name ?? "—"}</span>,
          <span key="src" className="rounded-full bg-cream-100 px-2 py-0.5 font-sans text-[11px] font-medium text-clove-600">
            {s.source}
          </span>,
          <span key="smp" className="font-sans text-xs text-clove-500">
            {formatDate(s.sampler_sent_at)}
          </span>,
          <span key="drip" className="font-sans text-xs text-clove-500">
            {s.last_drip_step}
          </span>,
          <span key="date" className="font-sans text-xs text-clove-400">
            {formatDate(s.created_at)}
          </span>,
          s.unsubscribed_at ? (
            <span key="st" className="font-sans text-xs text-paprika-500">Unsubscribed</span>
          ) : (
            <span key="st" className="font-sans text-xs text-cardamom-600">Active</span>
          ),
        ])}
      />
    </>
  );
}
