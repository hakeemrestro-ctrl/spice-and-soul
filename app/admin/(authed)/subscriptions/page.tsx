import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";

export const metadata = { title: "Subscriptions — Admin" };

type Subscription = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  status: string;
  monthly_cents: number;
  total_cents: number;
  installments_paid: number;
  installments_total: number;
  stripe_subscription_id: string;
  started_at: string;
  courses: { title: string } | null;
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function SubscriptionsPage() {
  const supabase = createAdminClient();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, customer_email, customer_name, status, monthly_cents, total_cents, installments_paid, installments_total, stripe_subscription_id, started_at, courses(title)")
    .order("started_at", { ascending: false })
    .returns<Subscription[]>();

  const rows = subs ?? [];
  const active = rows.filter((s) => s.status === "active").length;
  const revenue = rows.reduce((n, s) => n + s.installments_paid * s.monthly_cents, 0);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle={`${rows.length} plans · ${active} active · ${formatMoney(revenue)} collected`}
      />

      <DataTable
        cols={["Customer", "Course", "Progress", "Monthly", "Total", "Status", "Started"]}
        emptyMessage="No installment plans yet."
        rows={rows.map((s) => [
          <div key="c">
            <div className="font-sans text-sm font-medium text-clove-700">{s.customer_name ?? "—"}</div>
            <div className="font-sans text-xs text-clove-400">{s.customer_email}</div>
          </div>,
          <span key="course" className="font-sans text-sm text-clove-600">
            {(s.courses as unknown as { title: string } | null)?.title ?? "—"}
          </span>,
          <span key="prog" className="font-sans text-sm text-clove-700">
            {s.installments_paid}/{s.installments_total}
          </span>,
          <span key="mo" className="font-sans text-sm text-clove-700">
            {formatMoney(s.monthly_cents)}
          </span>,
          <span key="tot" className="font-sans text-sm font-semibold text-clove-700">
            {formatMoney(s.total_cents)}
          </span>,
          <StatusPill
            key="st"
            status={s.status === "active" ? "paid" : s.status === "past_due" ? "pending" : "refunded"}
            label={s.status}
          />,
          <span key="d" className="font-sans text-xs text-clove-400">
            {formatDate(s.started_at)}
          </span>,
        ])}
      />
    </>
  );
}
