import type { ReactNode } from "react";

type Props = {
  cols: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
};

export function DataTable({ cols, rows, emptyMessage = "Nothing yet." }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-0">
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="bg-cream-100">
            {cols.map((c) => (
              <th
                key={c}
                className="px-5 py-3 text-left font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-clove-400"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length}
                className="px-5 py-10 text-center font-sans text-sm italic text-clove-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-cream-200">
                {r.map((cell, j) => (
                  <td key={j} className="px-5 py-3.5 text-clove-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
