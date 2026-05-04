import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/restaurant", label: "Restaurant" },
  { href: "/resend", label: "Re-send PDFs" },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
];

export function SiteFooter() {
  return (
    <footer className="bg-clove-900 px-6 py-14 text-clove-200">
      <div className="mx-auto max-w-6xl">
        {/* Main row */}
        <div className="grid gap-10 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <Image src="/brand/monogram.svg" alt="" width={28} height={28} className="h-7 w-auto" />
              <div>
                <div className="font-display text-base text-cream-50">
                  Spice <span className="text-saffron-300">&amp;</span> Soul Academy
                </div>
                <div className="font-sans text-[9px] italic text-clove-400 tracking-wide">
                  by Hakeem&apos;s
                </div>
              </div>
            </div>
            <p className="font-sans text-xs leading-relaxed text-clove-400">
              Authentic Indian cooking courses — crafted from generations of kitchen wisdom. From dal to biryani, learn the flavours of India at home.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <div className="mb-4 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-clove-500">
              Quick Links
            </div>
            <ul className="flex flex-col gap-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans text-sm text-clove-300 no-underline transition-colors hover:text-cream-50"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Details */}
          <div>
            <div className="mb-4 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-clove-500">
              Company
            </div>
            <dl className="flex flex-col gap-2.5 font-sans text-xs text-clove-400">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-clove-500">Owner</dt>
                <dd className="mt-0.5 text-clove-200">Naveed Khan</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-clove-500">Company</dt>
                <dd className="mt-0.5 text-clove-200">NK Ventures</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-clove-500">GST No.</dt>
                <dd className="mt-0.5 font-mono text-[11px] text-clove-300 tracking-wider">
                  23CNEPK6523K1ZZ
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-clove-500">Restaurant</dt>
                <dd className="mt-0.5 text-clove-200">
                  <Link href="/restaurant" className="no-underline hover:text-cream-50 transition-colors">
                    Hakeem&apos;s · Indore, MP
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-clove-700/60 pt-6">
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {LEGAL.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-sans text-xs text-clove-500 no-underline transition-colors hover:text-cream-50"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-xs text-clove-500">
              © 2026 NK Ventures · Spice &amp; Soul Academy by Hakeem&apos;s · All rights reserved.
            </p>
            <p className="font-sans text-xs text-clove-600">
              Made with care, in a kitchen.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
