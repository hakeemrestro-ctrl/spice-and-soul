type Props = {
  label: string;
  value: string | number;
  delta?: string;
};

export function StatCard({ label, value, delta }: Props) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-0 px-6 py-5 shadow-warm-xs">
      <div className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-clove-400">
        {label}
      </div>
      <div className="font-display text-4xl leading-none text-clove-700">
        {value}
      </div>
      {delta && (
        <div className="mt-2 font-sans text-xs font-medium text-cardamom-600">
          ↑ {delta} vs last week
        </div>
      )}
    </div>
  );
}
