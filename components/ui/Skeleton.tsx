// Shaped loading placeholders, used instead of a bare spinner so the page
// doesn't jump once real content arrives.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-surface-border/60 ${className}`} style={style} />;
}

export function StockCardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-2 text-right flex flex-col items-end">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function ChartSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="w-full" style={{ height: Math.max(height - 44, 120) }} />
    </div>
  );
}

export function StockRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="hidden sm:block shrink-0" style={{ width: 88, height: 32 }} />
      <div className="shrink-0 w-28 flex flex-col items-end space-y-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
