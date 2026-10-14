import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  generateSignature: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("../../lib/paytm", () => ({
  PAYTM: { mid: "fixture-mid", host: "paytm.example.invalid" },
  generateSignature: mocks.generateSignature,
  paiseToTxnAmount: (value: number) => (value / 100).toFixed(2),
}));

import { POST } from "../../app/api/admin/orders/[id]/refund/route";

type QueryResult = { data: unknown; error: null };

function query(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => result),
    update: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  const profile = query({ data: { is_admin: true }, error: null });
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin" } } })) },
    from: vi.fn(() => profile),
  });
  mocks.generateSignature.mockResolvedValue("synthetic-signature");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network must not be reached");
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("rejects a BillDesk order before invoking Paytm signing or network code", async () => {
  const order = query({
    data: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      status: "paid",
      stripe_payment_intent_id: "BDTXN000000000001",
      amount_cents: 10000,
      parent_order_id: null,
    },
    error: null,
  });
  const pending = query({
    data: {
      order_id: "BD_ORDER",
      metadata: { paymentGateway: "billdesk" },
    },
    error: null,
  });
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => (table === "orders" ? order : pending)),
  });

  const response = await POST(
    new NextRequest("https://example.invalid/api/admin/orders/id/refund", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }) },
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "This payment must be refunded through its original provider.",
  });
  expect(mocks.generateSignature).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
