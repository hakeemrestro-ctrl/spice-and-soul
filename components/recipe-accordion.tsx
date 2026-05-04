import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { Recipe } from "@/types";

type Props = { recipes: Recipe[] };

function timingLabel(recipe: Recipe): string | null {
  const total =
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  return total > 0 ? `${total} min` : null;
}

export function RecipeAccordion({ recipes }: Props) {
  if (recipes.length === 0) {
    return (
      <p className="font-sans text-sm italic text-clove-400">
        Recipes coming soon.
      </p>
    );
  }

  return (
    <Accordion className="w-full">
      {recipes.map((recipe, index) => {
        const timing = timingLabel(recipe);
        return (
          <AccordionItem
            key={recipe.id}
            value={recipe.id}
            className="border-t border-cream-200 first:border-t-0 last:border-b last:border-cream-200"
          >
            <AccordionTrigger className="rounded-none border-none px-1 py-4 hover:no-underline data-[panel-open]:bg-transparent">
              <div className="flex flex-1 items-center gap-4 text-left">
                <span className="w-7 shrink-0 font-mono text-xs text-clove-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-sans text-base font-medium text-clove-700">
                  {recipe.title}
                </span>
                <span className="hidden shrink-0 font-sans text-xs text-clove-400 sm:flex sm:gap-3">
                  {timing && <span>{timing}</span>}
                  <span>{recipe.category}</span>
                </span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pl-10 text-sm leading-relaxed text-clove-500">
              {recipe.ingredients?.length || recipe.steps?.length ? (
                <div className="space-y-4 pb-4 pt-0">
                  {recipe.ingredients?.length ? (
                    <div>
                      <p className="mb-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-clove-400">
                        Ingredients
                      </p>
                      <ul className="list-inside list-disc space-y-1 text-clove-600">
                        {recipe.ingredients.map((ing, i) => (
                          <li key={i}>
                            {ing.quantity} {ing.unit} {ing.name}
                            {ing.notes ? ` (${ing.notes})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {recipe.steps?.length ? (
                    <div>
                      <p className="mb-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-clove-400">
                        Steps
                      </p>
                      <ol className="list-inside list-decimal space-y-1 text-clove-600">
                        {recipe.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="pb-4 pt-0 italic">
                  Full recipe details available after enrollment.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
