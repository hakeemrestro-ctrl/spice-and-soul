"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Drawer } from "@base-ui/react/drawer";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/restaurant", label: "Restaurant" },
  { href: "/resend", label: "Re-send PDFs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-cream-200 bg-cream-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap no-underline">
          <Image src="/brand/monogram.svg" alt="" width={36} height={36} className="h-9 w-auto" />
          <div>
            <div className="font-display text-lg leading-none text-clove-700">
              Spice <span className="text-paprika-400">&amp;</span> Soul
            </div>
            <div className="mt-0.5 font-sans text-[9.5px] font-semibold tracking-[0.22em] text-clove-400">
              ACADEMY
            </div>
            <div className="mt-0.5 font-sans text-[9px] italic text-clove-400/70 tracking-wide">
              by Hakeem&apos;s
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 whitespace-nowrap md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-1 py-2 font-sans text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-saffron-400 text-clove-700"
                    : "border-b-2 border-transparent text-clove-500 hover:text-clove-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <Link
            href="/courses/bundle-all-5"
            className="hidden rounded-full border border-saffron-300 bg-saffron-50 px-3 py-1.5 font-sans text-[12px] font-semibold text-saffron-700 transition-colors hover:bg-saffron-100 sm:inline-flex"
          >
            ✦ Get the Bundle
          </Link>
          <Link
            href="/courses"
            className="hidden rounded-[10px] bg-clove-700 px-4 py-2.5 font-sans text-[13.5px] font-semibold text-cream-50 hover:bg-clove-900 md:inline-flex"
          >
            Browse Courses
          </Link>

          {/* Hamburger trigger — mobile only */}
          <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Trigger
              aria-label="Open menu"
              aria-expanded={open}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-clove-600 transition-colors hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-saffron-400 md:hidden"
            >
              {open ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              )}
            </Drawer.Trigger>

            <Drawer.Portal>
              <Drawer.Backdrop className="fixed inset-0 z-40 bg-clove-900/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-200" />
              <Drawer.Popup className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-cream-50 shadow-xl data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full transition-transform duration-200 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
                  <span className="font-display text-base text-clove-700">Menu</span>
                  <Drawer.Close
                    aria-label="Close menu"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-clove-500 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-saffron-400"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 3l10 10M13 3l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </Drawer.Close>
                </div>

                {/* Nav links */}
                <nav className="flex flex-col gap-1 px-3 py-4">
                  {NAV.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname?.startsWith(item.href);
                    return (
                      <Drawer.Close key={item.href} render={
                        <Link
                          href={item.href}
                          className={`rounded-lg px-4 py-3 font-sans text-[15px] font-medium transition-colors ${
                            active
                              ? "bg-saffron-50 text-saffron-700"
                              : "text-clove-600 hover:bg-cream-100 hover:text-clove-700"
                          }`}
                        />
                      }>
                        {item.label}
                      </Drawer.Close>
                    );
                  })}
                </nav>

                {/* CTAs */}
                <div className="mt-auto flex flex-col gap-3 border-t border-cream-200 px-5 py-5">
                  <Link
                    href="/courses/bundle-all-5"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-saffron-300 bg-saffron-50 px-4 py-2.5 text-center font-sans text-[13px] font-semibold text-saffron-700 transition-colors hover:bg-saffron-100"
                  >
                    ✦ Get the Bundle
                  </Link>
                  <Link
                    href="/courses"
                    onClick={() => setOpen(false)}
                    className="rounded-[10px] bg-clove-700 px-4 py-2.5 text-center font-sans text-[14px] font-semibold text-cream-50 hover:bg-clove-900"
                  >
                    Browse Courses
                  </Link>
                </div>
              </Drawer.Popup>
            </Drawer.Portal>
          </Drawer.Root>
        </div>
      </div>
    </header>
  );
}
