import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 mb-1 font-display text-4xl leading-tight text-clove-700">
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 font-sans text-sm text-clove-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
