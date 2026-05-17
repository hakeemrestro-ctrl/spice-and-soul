import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const dmSerif = DM_Serif_Display({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export const metadata: Metadata = {
  title: "Spice & Soul Academy by Hakeem — Indian Cooking Courses",
  description:
    "Master authentic Indian cooking with 5 curated courses and 114 recipes. From dal to biryani — learn the flavours of India from your kitchen. By Hakeem, Bhopal.",
  metadataBase: new URL(BASE),
  openGraph: {
    title: "Spice & Soul Academy by Hakeem",
    description: "Master authentic Indian cooking — 5 courses, 114 recipes. By Hakeem Restaurant, Bhopal.",
    type: "website",
    url: BASE,
    siteName: "Spice & Soul Academy",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Spice & Soul Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spice & Soul Academy by Hakeem",
    description: "Master authentic Indian cooking — 5 courses, 114 recipes. By Hakeem Restaurant, Bhopal.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable}`}
    >
      <body className="antialiased">
        {children}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
