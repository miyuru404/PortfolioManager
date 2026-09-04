import IndexTicker from "@/components/ui/IndexTicker";
import ThemeToggle from "@/components/ui/ThemeToggle";

// Shared page header — title/subtitle on the left, live index ticker and
// the light/dark quick-toggle on the right, all above a hairline rule.
// Every top-level page renders this instead of its own ad hoc <h1> block,
// so the header row (and its live ASPI/SL20 readout) stays consistent
// with the Ceylon Capital Revamp design across the whole app.
export default function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap pb-5 sm:pb-6 mb-6 border-b border-surface-border">
      <div className="min-w-0">
        <h1 className="font-heading text-xl sm:text-2xl" style={{ color: "rgb(var(--ink))" }}>{title}</h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: "rgb(var(--ink-muted))" }}>{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4 sm:gap-5 shrink-0">
        <IndexTicker />
        <ThemeToggle />
      </div>
    </div>
  );
}
