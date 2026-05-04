export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { ReservationConfirmationEmail } from "@/components/email-templates/reservation-confirmation";
import { ReservationNotifyStaffEmail } from "@/components/email-templates/reservation-notify-staff";

const ReservationSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().max(30).optional(),
  partySize: z.number().int().min(1).max(20),
  preferredDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, phone, partySize, preferredDate, notes } = parsed.data;
  const supabase = createAdminClient();

  const { error } = await supabase.from("reservations").insert({
    name,
    email: email.toLowerCase(),
    phone: phone ?? null,
    party_size: partySize,
    preferred_date: preferredDate ?? null,
    notes: notes ?? null,
    source: "website",
  });

  if (error) {
    console.error("Failed to save reservation:", error);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  // Upsert subscriber (best effort, non-blocking)
  void supabase
    .from("subscribers")
    .upsert({ email: email.toLowerCase(), name, source: "reservation" }, { onConflict: "email" });

  // Send confirmation to guest + notify staff (best effort)
  void Promise.all([
    resend.emails.send({
      from: "Hakeem's Restaurant <hello@spiceandsoul.com>",
      replyTo: "restaurant@spiceandsoul.com",
      to: email,
      subject: "Reservation request received — Hakeem's Restaurant",
      react: createElement(ReservationConfirmationEmail, {
        guestName: name,
        partySize,
        preferredDate: preferredDate ?? null,
        notes: notes ?? null,
      }),
    }),
    resend.emails.send({
      from: "Hakeem's Restaurant <hello@spiceandsoul.com>",
      to: "restaurant@spiceandsoul.com",
      subject: `New reservation: ${name} · ${partySize} people`,
      react: createElement(ReservationNotifyStaffEmail, {
        guestName: name,
        guestEmail: email,
        guestPhone: phone ?? null,
        partySize,
        preferredDate: preferredDate ?? null,
        notes: notes ?? null,
      }),
    }),
  ]).catch((err) => console.error("Reservation email failed:", err));

  return NextResponse.json({ ok: true });
}
