"use client";

type Check = { position: number | null; checkedAt: string | Date };

export default function RankSparkline({ checks }: { checks: Check[] }) {
  const ordered = [...checks].reverse(); // oldest -> newest
  const positions = ordered.map((c) => c.position).filter((p): p is number => p !== null);

  if (positions.length === 0) {
    return <span className="text-xs text-caption">No data yet</span>;
  }
  if (positions.length === 1) {
    return <span className="text-sm font-semibold text-foreground">#{positions[0]}</span>;
  }

  const max = Math.max(...positions);
  const min = Math.min(...positions);
  const range = Math.max(max - min, 1);
  const width = 100;
  const height = 28;

  const points = ordered.map((c, i) => {
    const x = (i / (ordered.length - 1)) * width;
    // Invert: lower position (better rank) plots higher on the chart.
    const y = c.position === null ? height / 2 : ((c.position - min) / range) * (height - 4) + 2;
    return { x, y, position: c.position };
  });

  const pathD = points
    .filter((p) => p.position !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const latest = positions[positions.length - 1];
  const first = positions[0];
  const improved = latest < first;

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="flex-shrink-0">
        <path d={pathD} fill="none" stroke={improved ? "#16a34a" : "#dc2626"} strokeWidth={1.5} />
      </svg>
      <div>
        <div className="text-sm font-semibold text-foreground">#{latest}</div>
        <div className={`text-xs ${improved ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {improved ? "↑" : latest > first ? "↓" : "—"} from #{first}
        </div>
      </div>
    </div>
  );
}
