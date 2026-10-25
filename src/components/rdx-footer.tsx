/**
 * Animated footer: a clearly visible RED illustrated RDX car that drives
 * across the road from left to right in a continuous loop. Pure CSS/SVG
 * animation — no animation library. Wheels rotate, the body bobs, road
 * dashes stream by and clouds drift in the background.
 */
export function RdxFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border">
      <div className="relative h-32 sm:h-36">
        {/* drifting clouds */}
        <svg
          className="rdx-cloud absolute left-0 top-2 w-full"
          height="40"
          viewBox="0 0 1100 40"
          aria-hidden="true"
        >
          <g fill="var(--rdx-glass)" opacity="0.55">
            <ellipse cx="80" cy="26" rx="34" ry="11" />
            <ellipse cx="102" cy="21" rx="24" ry="10" />
            <ellipse cx="58" cy="22" rx="20" ry="9" />
            <ellipse cx="430" cy="18" rx="40" ry="12" />
            <ellipse cx="458" cy="14" rx="26" ry="10" />
            <ellipse cx="860" cy="28" rx="30" ry="10" />
            <ellipse cx="884" cy="23" rx="20" ry="8" />
          </g>
        </svg>
        <svg
          className="rdx-cloud-slow absolute left-0 top-8 w-full"
          height="40"
          viewBox="0 0 1100 40"
          aria-hidden="true"
        >
          <g fill="var(--rdx-glass)" opacity="0.35">
            <ellipse cx="240" cy="20" rx="36" ry="10" />
            <ellipse cx="268" cy="16" rx="24" ry="9" />
            <ellipse cx="660" cy="24" rx="44" ry="12" />
            <ellipse cx="692" cy="20" rx="28" ry="10" />
          </g>
        </svg>

        {/* road */}
        <svg
          className="absolute bottom-0 left-0 h-10 w-full"
          preserveAspectRatio="none"
          viewBox="0 0 1200 40"
          aria-hidden="true"
        >
          <rect width="1200" height="40" fill="var(--rdx-ink)" opacity="0.9" />
          <rect y="0" width="1200" height="3" fill="var(--brand-yellow)" opacity="0.85" />
          <line
            className="rdx-road"
            x1="0"
            y1="21"
            x2="1200"
            y2="21"
            stroke="var(--brand-yellow)"
            strokeWidth="4"
            strokeDasharray="38 26"
            strokeLinecap="round"
          />
        </svg>

        {/* car */}
        <div className="rdx-drive absolute bottom-9 left-0">
          <CarSvg />
        </div>
      </div>
      <p className="pb-3 text-center text-xs font-semibold text-muted-foreground">
        Harsh Quiz Portal — RDX Quiz Series
      </p>
    </footer>
  );
}

function CarSvg() {
  return (
    <svg
      className="rdx-bob"
      width="240"
      height="80"
      viewBox="0 0 240 80"
      aria-label="Red RDX car driving across the road"
    >
      {/* ground shadow */}
      <ellipse cx="118" cy="68" rx="104" ry="5" fill="var(--background)" opacity="0.5" />
      {/* cabin */}
      <path
        d="M58 38 Q66 16 96 14 L138 14 Q160 16 170 38 Z"
        fill="var(--rdx-red)"
      />
      {/* windows */}
      <path d="M70 36 Q76 20 98 19 L112 19 L112 36 Z" fill="var(--rdx-glass)" />
      <path d="M118 19 L134 19 Q152 21 160 36 L118 36 Z" fill="var(--rdx-glass)" />
      {/* roof highlight */}
      <path d="M66 22 Q80 15 100 14 L100 18 Q84 19 72 25 Z" fill="var(--rdx-red-dark)" />
      {/* body */}
      <path
        d="M18 38 L208 38 Q216 38 216 46 L214 56 Q214 60 208 60 L26 60 Q18 60 18 54 L18 44 Q18 38 18 38 Z"
        fill="var(--rdx-red)"
      />
      {/* body shading */}
      <rect x="20" y="54" width="192" height="5" rx="2.5" fill="var(--rdx-red-dark)" opacity="0.85" />
      {/* bumper + chrome trim */}
      <rect x="20" y="48" width="196" height="3" rx="1.5" fill="var(--rdx-chrome)" opacity="0.9" />
      {/* RDX lettering — black, bold */}
      <text
        x="116"
        y="46"
        textAnchor="middle"
        fontSize="15"
        fontWeight="900"
        letterSpacing="4"
        fill="var(--rdx-ink)"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        RDX
      </text>
      {/* headlight (yellow) + taillight (red) */}
      <circle cx="212" cy="42" r="4" fill="var(--brand-yellow)" />
      <circle cx="212" cy="42" r="1.8" fill="var(--rdx-ink)" opacity="0.5" />
      <rect x="15" y="41" width="6" height="6" rx="2" fill="var(--brand-red)" />
      {/* exhaust puff */}
      <circle cx="8" cy="58" r="3" fill="var(--rdx-glass)" opacity="0.6" />
      {/* wheels */}
      <g className="rdx-wheel" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx="62" cy="60" r="12" fill="var(--rdx-ink)" />
        <circle cx="62" cy="60" r="6" fill="var(--rdx-chrome)" />
        <line x1="62" y1="54" x2="62" y2="66" stroke="var(--rdx-ink)" strokeWidth="2.5" />
        <line x1="56" y1="60" x2="68" y2="60" stroke="var(--rdx-ink)" strokeWidth="2.5" />
      </g>
      <g className="rdx-wheel" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx="178" cy="60" r="12" fill="var(--rdx-ink)" />
        <circle cx="178" cy="60" r="6" fill="var(--rdx-chrome)" />
        <line x1="178" y1="54" x2="178" y2="66" stroke="var(--rdx-ink)" strokeWidth="2.5" />
        <line x1="172" y1="60" x2="184" y2="60" stroke="var(--rdx-ink)" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
