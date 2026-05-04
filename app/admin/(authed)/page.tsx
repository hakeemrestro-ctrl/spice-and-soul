import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { DataTable } from "@/components/admin/data-table";

export const metadata = { title: "Admin — Spice & Soul Academy" };

type RecentOrder = {
  id: string;
  invoice_number: string;
  customer_email: string;
  amount_cents: number;
  created_at: string;
  course: { title: string } | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminPage() {
  const supabase = createAdminClient();
  // server component reads request-time clock; safe to call impure function
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Stats: published courses (all-time), orders + revenue (last 7 days, paid,
  // top-level only — bundle children carry amount_cents=0 to avoid double-count)
  const [
    { count: coursesCount },
    { count: ordersCount },
    { data: revenueRows },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("published", true),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid")
      .is("parent_order_id", null)
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("orders")
      .select("amount_cents")
      .eq("status", "paid")
      .is("parent_order_id", null)
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("orders")
      .select(
        "id, invoice_number, customer_email, amount_cents, created_at, course:courses(title)",
      )
      .eq("status", "paid")
      .is("parent_order_id", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalRevenue =
    revenueRows?.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0) ?? 0;
  const avgOrder =
    revenueRows && revenueRows.length > 0
      ? totalRevenue / revenueRows.length
      : 0;

  const orders = (recentOrders ?? []) as unknown as RecentOrder[];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Last 7 days" />

      <div className="mb-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published Courses" value={coursesCount ?? 0} />
        <StatCard label="Orders (7d)" value={ordersCount ?? 0} />
        <StatCard label="Revenue (7d)" value={formatMoney(totalRevenue)} />
        <StatCard label="Avg. Order (7d)" value={formatMoney(avgOrder)} />
      </div>

      <h2 className="mb-4 font-display text-2xl text-clove-700">Recent orders</h2>
      <DataTable
        cols={["Invoice", "Customer", "Course", "Amount", "Date"]}
        emptyMessage="No paid orders yet."
        rows={orders.map((o) => [
          <span key="i" className="font-mono text-xs text-clove-500">
            {o.invoice_number}
          </span>,
          o.customer_email,
          o.course?.title ?? "—",
          formatMoney(o.amount_cents),
          <span key="d" className="text-clove-400">
            {formatDate(o.created_at)}
          </span>,
        ])}
      />
    </>
  );
}
