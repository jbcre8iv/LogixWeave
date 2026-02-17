interface MiniHealthRingProps {
  score: number | null;
  size?: number;
}

function getColor(score: number) {
  if (score >= 80) return { stroke: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 50) return { stroke: "stroke-yellow-500", text: "text-yellow-600 dark:text-yellow-400" };
  return { stroke: "stroke-red-500", text: "text-red-600 dark:text-red-400" };
}

export function MiniHealthRing({ score, size = 36 }: MiniHealthRingProps) {
  if (score === null) {
    return (
      <span className="text-[10px] font-medium text-muted-foreground/60 leading-tight text-center whitespace-nowrap">
        No Data
      </span>
    );
  }

  const color = getColor(score);
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      title={`Health Score: ${score}/100`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted/30"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={color.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span
        className={`absolute font-bold leading-none ${color.text}`}
        style={{ fontSize: Math.round(size * 0.28) }}
      >
        {score}
      </span>
    </div>
  );
}
