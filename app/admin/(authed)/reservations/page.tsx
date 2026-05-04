import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { ReservationStatusSelect } from "@/components/admin/reservation-status-select";

export const metadata = { title: "Reservations — Admin" };

type Reservation = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  party_size: number;
  preferred_date: string | null;
  notes: string | null;
  status: string;
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

export default async function ReservationsPage() {
  const supabase = createAdminClient();

  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, name, email, phone, party_size, preferred_date, notes, status, created_at")
    .order("created_at", { ascending: false })
    .returns<Reservation[]>();

  const rows = (reservations ?? []);
  const newCount = rows.filter((r) => r.status === "new" || !r.status).length;

  return (
    <>
      <PageHeader
        title="Reservations"
        subtitle={`${rows.length} total · ${newCount} new`}
      />

      <DataTable
        cols={["Guest", "Party", "Date Requested", "Notes", "Status", "Received"]}
        emptyMessage="No reservations yet."
        rows={rows.map((r) => [
          <div key="g">
            <div className="font-sans text-sm font-medium text-clove-700">{r.name}</div>
            <div className="font-sans text-xs text-clove-400">{r.email}</div>
            {r.phone && <div className="font-sans text-xs text-clove-400">{r.phone}</div>}
          </div>,
          <span key="p" className="font-sans text-sm text-clove-600">
            {r.party_size} {r.party_size === 1 ? "person" : "people"}
          </span>,
          <span key="d" className="font-sans text-sm text-clove-600">
            {formatDate(r.preferred_date)}
          </span>,
          <p key="n" className="max-w-xs font-sans text-xs leading-relaxed text-clove-500 line-clamp-2">
            {r.notes ?? <span className="italic text-clove-300">—</span>}
          </p>,
          <ReservationStatusSelect
            key="s"
            reservationId={r.id}
            currentStatus={r.status ?? "new"}
          />,
          <span key="c" className="font-sans text-xs text-clove-400">
            {formatDate(r.created_at)}
          </span>,
        ])}
      />
    </>
  );
}
