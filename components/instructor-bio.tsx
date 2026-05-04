import Image from "next/image";

// Instructor bio block — establishes the human behind the courses.
// Reusable across course detail page and homepage.

type Props = {
  /** Optional override of the default Hakeem bio for future instructors. */
  name?: string;
  credential?: string;
  bio?: string;
  imageUrl?: string;
};

const DEFAULT_INSTRUCTOR = {
  name: "Ustad Hakeem",
  credential: "Master Cook · 30+ years across Lucknow, Delhi & Hyderabad",
  bio: "Ustad Hakeem began cooking in his family kitchen in 1987. After three decades across Lucknow, Delhi, and Hyderabad's most exacting kitchens, his recipes are now passed to home cooks worldwide — every measurement, every patience-test, every spice ratio preserved.",
};

export function InstructorBio({
  name = DEFAULT_INSTRUCTOR.name,
  credential = DEFAULT_INSTRUCTOR.credential,
  bio = DEFAULT_INSTRUCTOR.bio,
  imageUrl,
}: Props) {
  return (
    <section className="rounded-2xl border border-cream-200 bg-cream-50 p-6 sm:p-8">
      <div className="eyebrow mb-4">YOUR INSTRUCTOR</div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
        <div className="shrink-0">
          {imageUrl ? (
            <div className="relative size-20 overflow-hidden rounded-full ring-2 ring-cream-200 sm:size-24">
              <Image src={imageUrl} alt={name ?? ""} fill className="object-cover" />
            </div>
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-clove-700 sm:size-24">
              <span className="font-display text-3xl italic leading-none text-cream-50 sm:text-4xl">
                H
              </span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="m-0 font-display text-2xl leading-tight text-clove-700">
            {name}
          </h3>
          <p className="mb-3 mt-1 font-sans text-xs uppercase tracking-[0.12em] text-saffron-600">
            {credential}
          </p>
          <p className="font-sans text-[15px] leading-relaxed text-clove-600">
            {bio}
          </p>
        </div>
      </div>
    </section>
  );
}
