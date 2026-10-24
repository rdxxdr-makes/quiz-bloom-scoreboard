/**
 * Animated footer: an illustrated RDX car that drives across the road in a
 * continuous loop. Pure CSS/SVG animation — no animation library.
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
          <g fill="var(--muted)" opacity="0.5">
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
          <g fill="var(--muted)" opacity="0.3">
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
          <rect width="1200" height="40" fill="var(--card)" />
          <rect y="0" width="1200" height="3" fill="var(--border)" />
          <line
            className="rdx-road"
            x1="0"
            y1="21"
            x2="1200"
            y2="21"
            stroke="var(--primary)"
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
      <p className="pb-3 text-center text-xs text-muted-foreground">
        Harsh Quiz Portal — RDX Quiz Series
      </p>
    </footer>
  );
}

function CarSvg() {
  return (
    <svg
      className="rdx-bob"
      width="220"
      height="72"
      viewBox="0 0 220 72"
      aria-label="RDX car"
    >
      {/* ground shadow */}
      <ellipse cx="108" cy="62" rx="98" ry="5" fill="var(--background)" opacity="0.55" />
      {/* cabin */}
      <path
        d="M52 34 Q60 14 88 12 L128 12 Q148 14 158 34 Z"
        fill="var(--accent)"
      />
      {/* windows */}
      <path d="M64 32 Q70 18 90 17 L104 17 L104 32 Z" fill="var(--background)" />
      <path d="M110 17 L124 17 Q140 19 148 32 L110 32 Z" fill="var(--background)" />
      {/* body */}
      <path
        d="M18 34 L206 34 Q212 34 212 42 L210 50 Q210 54 204 54 L24 54 Q16 54 16 48 L16 40 Q16 34 18 34 Z"
        fill="var(--accent)"
      />
      {/* body stripe */}
      <rect x="20" y="44" width="188" height="4" rx="2" fill="var(--background)" opacity="0.35" />
      {/* RDX lettering */}
      <text
        x="108"
        y="42"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        letterSpacing="3"
        fill="var(--primary-foreground)"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        RDX
      </text>
      {/* headlight + taillight */}
      <circle cx="206" cy="38" r="3" fill="var(--primary)" />
      <rect x="14" y="37" width="5" height="5" rx="1.5" fill="var(--destructive)" />
      {/* wheels */}
      <g className="rdx-wheel" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx="58" cy="54" r="11" fill="var(--foreground)" />
        <circle cx="58" cy="54" r="5.5" fill="var(--muted)" />
        <line x1="58" y1="49" x2="58" y2="59" stroke="var(--foreground)" strokeWidth="2" />
        <line x1="53" y1="54" x2="63" y2="54" stroke="var(--foreground)" strokeWidth="2" />
      </g>
      <g className="rdx-wheel" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx="162" cy="54" r="11" fill="var(--foreground)" />
        <circle cx="162" cy="54" r="5.5" fill="var(--muted)" />
        <line x1="162" y1="49" x2="162" y2="59" stroke="var(--foreground)" strokeWidth="2" />
        <line x1="157" y1="54" x2="167" y2="54" stroke="var(--foreground)" strokeWidth="2" />
      </g>
    </svg>
  );
}
