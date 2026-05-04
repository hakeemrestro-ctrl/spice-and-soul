"use client";

import { useState, useTransition } from "react";
import { adminLogin } from "./actions";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminLogin({ email, password, next });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>
      <div>
        <label className="mb-1.5 block font-sans text-[13px] font-medium text-clove-700">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-[10px] border border-clove-200 bg-cream-0 px-3.5 py-2.5 font-sans text-[15px] text-clove-700 outline-none focus:border-2 focus:border-saffron-400 focus:ring-4 focus:ring-saffron-400/20"
        />
      </div>
      {error && (
        <p className="font-sans text-sm text-paprika-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-clove-700 p-3.5 font-sans text-[15px] font-semibold text-cream-50 transition-colors hover:bg-clove-900 disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
