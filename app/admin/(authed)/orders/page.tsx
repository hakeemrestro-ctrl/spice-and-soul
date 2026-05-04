import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import { RefundButton } from "@/components/admin/refund-button";

export const metadata = { title: "Orders — Admin" };

type Order = {
  id: string;
  invoice_number: string;
  customer_email: string;
  amount_cents: number;
  status: "paid" | "refunded" | "pending";
  created_at: string;
  course: { title: string } | null;
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminOrdersPage() {
  const supabase = createAdminClient();

  // Top-level orders only — bundle children are accounting detail
  const { data: rawOrders } = await supabase
    .from("orders")
    .select("*, course:courses(title)")
    .is("parent_order_id", null)
    .order("created_at", { ascending: false });

  const orders = (rawOrders ?? []) as unknown as Order[];
  const paidTotal = orders
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + o.amount_cents, 0);

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} total · ${formatMoney(paidTotal)} collected`}
      />

      <DataTable
        cols={["Invoice", "Customer", "Course", "Amount", "Status", "Date", ""]}
        emptyMessage="No orders yet."
        rows={orders.map((o) => [
          <span key="i" className="font-mono text-xs text-clove-500">
            {o.invoice_number}
          </span>,
          o.customer_email,
          o.course?.title ?? "—",
          formatMoney(o.amount_cents),
          <StatusPill key="s" status={o.status} />,
          <span key="d" className="text-clove-400">
            {formatDate(o.created_at)}
          </span>,
          o.status === "paid" ? (
            <RefundButton key="r" orderId={o.id} />
          ) : (
            <span key="r" />
          ),
        ])}
      />
    </>
  );
}
