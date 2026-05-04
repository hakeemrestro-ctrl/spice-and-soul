import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import { CreateCouponButton } from "@/components/admin/create-coupon-button";
import { ToggleCouponButton } from "@/components/admin/toggle-coupon-button";
import { EditCouponButton } from "@/components/admin/edit-coupon-button";

export const metadata = { title: "Coupons — Admin" };

type Coupon = {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_cents: number | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function formatDiscount(c: Coupon): string {
  if (c.discount_percent) return `${c.discount_percent}%`;
  if (c.discount_cents) return `$${(c.discount_cents / 100).toFixed(2)}`;
  return "—";
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function CouponsPage() {
  const supabase = createAdminClient();

  const { data: coupons } = await supabase
    .from("coupons")
    .select("id, code, discount_percent, discount_cents, max_uses, uses_count, expires_at, is_active, created_at")
    .order("created_at", { ascending: false })
    .returns<Coupon[]>();

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Manage promotional codes and discounts."
        action={<CreateCouponButton />}
      />

      <DataTable
        cols={["Code", "Discount", "Uses", "Expires", "Status", ""]}
        emptyMessage="No coupons yet."
        rows={(coupons ?? []).map((c) => [
          <span key="code" className="font-mono font-semibold text-clove-700">
            {c.code}
          </span>,
          formatDiscount(c),
          c.max_uses != null
            ? `${c.uses_count} / ${c.max_uses}`
            : `${c.uses_count} / ∞`,
          formatDate(c.expires_at),
          <StatusPill
            key="status"
            status={c.is_active ? "paid" : "refunded"}
            label={c.is_active ? "Active" : "Inactive"}
          />,
          <div key="actions" className="flex items-center gap-2">
            <EditCouponButton coupon={{ id: c.id, discount_percent: c.discount_percent, max_uses: c.max_uses, expires_at: c.expires_at }} />
            <ToggleCouponButton couponId={c.id} isActive={c.is_active} />
          </div>,
        ])}
      />
    </>
  );
}
