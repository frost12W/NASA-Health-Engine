export type VisorState = "off" | "live" | "scan";

const LABEL: Record<VisorState, string> = {
  off: "STANDBY",
  live: "CAMERA",
  scan: "SCAN",
};

export function VisorFrame({ state }: { state: VisorState }) {
  return (
    <svg className={`visor visor-${state}`} viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke">
        <path d="M22 86 V22 H104" />
        <path d="M34 68 V34 H86" />
        <path d="M978 86 V22 H896" />
        <path d="M966 68 V34 H914" />
        <path d="M22 474 V538 H104" />
        <path d="M34 492 V526 H86" />
        <path d="M978 474 V538 H896" />
        <path d="M966 492 V526 H914" />
        <path d="M150 22 H410" />
        <path d="M590 22 H850" />
        <path d="M22 168 H48 M22 198 H36 M22 228 H48" />
        <path d="M978 168 H952 M978 198 H964 M978 228 H952" />
        <path d="M170 538 H250 M290 538 H370 M410 538 H470" />
        <path d="M530 538 H590 M630 538 H710 M750 538 H830" />
      </g>
      <text x="500" y="18" textAnchor="middle" fill="currentColor" fontSize="16" fontFamily="Cascadia Mono, Consolas, monospace" letterSpacing="3">
        {LABEL[state]}
      </text>
      {state === "scan" && (
        <g className="visor-scanline">
          <line x1="48" x2="952" y1="0" y2="0" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </svg>
  );
}
