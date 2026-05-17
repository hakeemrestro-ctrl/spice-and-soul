export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { DailyDigestEmail } from "@/components/email-templates/daily-digest";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: orders },
    { count: newSubscribers },
    { count: pendingReviews },
    { count: newReservations },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("amount_cents")
      .is("parent_order_id", null)
      .eq("status", "paid")
      .gte("created_at", since),
    supabase
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("published", false)
      .not("body", "is", null),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  const ordersCount = orders?.length ?? 0;
  const revenueCents = (orders ?? []).reduce((s, o) => s + o.amount_cents, 0);
  const revenueUsd = `$${(revenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const adminEmail = process.env.ADMIN_DIGEST_EMAIL ?? "hakeemrestro@gmail.com";

  await resend.emails.send({
    from: "Spice & Soul Academy <hello@hakeemrestro.shop>",
    to: adminEmail,
    subject: `Daily digest — ${date}`,
    react: createElement(DailyDigestEmail, {
      date,
      ordersCount,
      revenueUsd,
      newSubscribers: newSubscribers ?? 0,
      pendingReviews: pendingReviews ?? 0,
      newReservations: newReservations ?? 0,
    }),
  });

  return NextResponse.json({ ok: true, ordersCount, revenueUsd });
}
