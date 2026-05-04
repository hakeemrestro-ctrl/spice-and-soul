import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// FAQ accordion — answers the friction questions before purchase.
// Pulls from a sensible default set; can be overridden per page.

export type FaqItem = {
  q: string;
  a: string;
};

type Props = {
  items?: FaqItem[];
  heading?: string;
};

const DEFAULT_FAQ: FaqItem[] = [
  {
    q: "How do I access the course after purchase?",
    a: "Instantly. Within minutes of payment you receive an email with your full recipe book PDF and an invoice. Lost the email? Visit /resend anytime — enter the email used at checkout and we'll send the PDFs again.",
  },
  {
    q: "Can I download and keep the recipes?",
    a: "Yes. Every course comes with a beautifully typeset PDF recipe book — yours forever. Print it, save it, share it across your devices.",
  },
  {
    q: "Is there video content included?",
    a: "Currently the courses are detailed text + photos with extensive technique notes and tips from Hakeem's 30 years of experience. Step-by-step video tutorials are planned for 2026 and will be added to your account at no extra cost.",
  },
  {
    q: "How long do I have access?",
    a: "Lifetime. One purchase, permanent access. No subscription, no expiry, no upsells.",
  },
  {
    q: "What's your refund policy?",
    a: "30-day money-back guarantee, no questions asked. If the course isn't right for you, just reply to the welcome email within 30 days and we'll refund in full.",
  },
  {
    q: "Are the recipes vegetarian-friendly?",
    a: "Many recipes are vegetarian — every recipe is clearly labeled by category (Vegetarian, Main, Seafood, etc.). The Sweets and South Indian courses are heavily vegetarian; the Street Food course is roughly half-and-half.",
  },
];

export function FaqAccordion({
  items = DEFAULT_FAQ,
  heading = "Frequently asked questions",
}: Props) {
  return (
    <section>
      <div className="eyebrow mb-3">QUESTIONS</div>
      <h2 className="mb-5 font-display text-2xl text-clove-700">{heading}</h2>
      <Accordion className="w-full">
        {items.map((item, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="border-t border-cream-200 first:border-t-0 last:border-b last:border-cream-200"
          >
            <AccordionTrigger className="rounded-none border-none px-1 py-4 text-base font-medium text-clove-700 hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="pl-1 text-[15px] leading-relaxed text-clove-500">
              <p className="pb-4">{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
