"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ShoppingBag, Sparkles, Tag, Star, Users, CalendarDays, CreditCard, Gift, type LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; Icon: LucideIcon };

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", Icon: Sparkles },
  { href: "/admin/courses", label: "Courses", Icon: BookOpen },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingBag },
  { href: "/admin/subscriptions", label: "Subscriptions", Icon: CreditCard },
  { href: "/admin/coupons", label: "Coupons", Icon: Tag },
  { href: "/admin/reviews", label: "Reviews", Icon: Star },
  { href: "/admin/reservations", label: "Reservations", Icon: CalendarDays },
  { href: "/admin/subscribers", label: "Subscribers", Icon: Users },
  { href: "/admin/gift-orders", label: "Gift Orders", Icon: Gift },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-58 shrink-0 flex-col gap-6 border-r border-cream-200 bg-cream-50 px-5 py-7">
      <div className="flex items-center gap-2.5 whitespace-nowrap px-1.5">
        <Image
          src="/brand/monogram.svg"
          alt=""
          width={32}
          height={32}
          className="h-8 w-auto"
        />
        <div>
          <div className="font-display text-sm leading-tight text-clove-700">
            Spice <span className="text-paprika-400">&amp;</span> Soul
          </div>
          <div className="font-sans text-[9px] font-semibold tracking-[0.18em] text-clove-400">
            ADMIN
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-sans text-[13.5px] no-underline transition-colors ${
                active
                  ? "bg-saffron-100 font-semibold text-clove-700"
                  : "font-medium text-clove-500 hover:bg-cream-100 hover:text-clove-700"
              }`}
            >
              <Icon className="size-4 opacity-85" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[10px] bg-cream-100 p-3 font-sans text-xs text-clove-500">
        <div className="mb-1 font-semibold text-clove-700">Signed in</div>
        <div className="truncate">{email}</div>
      </div>
    </aside>
  );
}
