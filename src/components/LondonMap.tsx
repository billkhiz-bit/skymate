"use client";

type Pos = { x: number; y: number };

const POSTCODE_POSITIONS: Record<string, Pos> = {
  // viewBox is 200x140. Roughly: x=0 west, x=200 east, y=0 north, y=140 south
  // Central
  W1: { x: 100, y: 75 },
  WC1: { x: 105, y: 73 },
  WC2: { x: 105, y: 76 },
  EC1: { x: 113, y: 73 },
  EC2: { x: 115, y: 75 },
  EC3: { x: 117, y: 77 },
  EC4: { x: 113, y: 77 },
  // West / NW
  W2: { x: 92, y: 73 },
  W6: { x: 78, y: 80 },
  W8: { x: 88, y: 78 },
  W11: { x: 88, y: 73 },
  W12: { x: 78, y: 75 },
  NW1: { x: 100, y: 65 },
  NW3: { x: 95, y: 55 },
  NW5: { x: 100, y: 58 },
  NW6: { x: 90, y: 60 },
  NW8: { x: 95, y: 65 },
  NW10: { x: 78, y: 60 },
  // North
  N1: { x: 110, y: 65 },
  N4: { x: 113, y: 55 },
  N7: { x: 108, y: 58 },
  N16: { x: 118, y: 58 },
  N19: { x: 105, y: 53 },
  // East
  E1: { x: 125, y: 76 },
  E2: { x: 125, y: 72 },
  E8: { x: 125, y: 68 },
  E14: { x: 137, y: 84 },
  E15: { x: 140, y: 70 },
  E20: { x: 142, y: 65 },
  // SE
  SE1: { x: 115, y: 82 },
  SE8: { x: 132, y: 88 },
  SE10: { x: 138, y: 88 },
  SE11: { x: 110, y: 86 },
  SE15: { x: 120, y: 95 },
  SE16: { x: 125, y: 85 },
  SE17: { x: 115, y: 88 },
  SE18: { x: 148, y: 92 },
  // SW
  SW1: { x: 102, y: 82 },
  SW3: { x: 92, y: 84 },
  SW6: { x: 85, y: 88 },
  SW7: { x: 90, y: 80 },
  SW8: { x: 100, y: 90 },
  SW9: { x: 105, y: 95 },
  SW11: { x: 95, y: 92 },
  SW15: { x: 80, y: 95 },
  SW17: { x: 85, y: 105 },
  SW19: { x: 75, y: 110 },
  // Outer
  CR0: { x: 105, y: 120 },
  BR1: { x: 145, y: 110 },
  HA1: { x: 60, y: 50 },
  KT1: { x: 65, y: 110 },
};

const AREA_CENTERS: Record<string, Pos> = {
  N: { x: 110, y: 55 },
  NW: { x: 92, y: 60 },
  W: { x: 80, y: 75 },
  WC: { x: 105, y: 75 },
  EC: { x: 115, y: 75 },
  E: { x: 130, y: 75 },
  SE: { x: 125, y: 90 },
  SW: { x: 92, y: 90 },
  CR: { x: 105, y: 120 },
  BR: { x: 145, y: 110 },
  HA: { x: 60, y: 50 },
  KT: { x: 65, y: 110 },
  TW: { x: 50, y: 80 },
  EN: { x: 110, y: 30 },
  IG: { x: 160, y: 60 },
  RM: { x: 170, y: 70 },
};

function lookup(postcode: string): Pos | null {
  const key = postcode.trim().toUpperCase().replace(/\s+/g, "");
  if (!key) return null;
  if (POSTCODE_POSITIONS[key]) return POSTCODE_POSITIONS[key];
  const district = key.match(/^([A-Z]+\d+[A-Z]?)/);
  if (district && POSTCODE_POSITIONS[district[1]]) return POSTCODE_POSITIONS[district[1]];
  const area = key.match(/^([A-Z]+)/);
  if (area && AREA_CENTERS[area[1]]) return AREA_CENTERS[area[1]];
  return null;
}

const MARKER_COLORS = ["#10b981", "#06b6d4"];

export default function LondonMap({ postcodes }: { postcodes: string[] }) {
  const points = postcodes
    .map((p, i) => ({ postcode: p, pos: lookup(p), color: MARKER_COLORS[i % MARKER_COLORS.length] }))
    .filter((p): p is { postcode: string; pos: Pos; color: string } => p.pos !== null);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/30">
      <header className="flex items-center justify-between bg-zinc-900 px-4 py-2.5 border-b border-zinc-800">
        <h3 className="text-sm font-semibold tracking-wide">Greater London — postcode geometry</h3>
        <span className="text-xs text-zinc-500 font-mono">flight corridors · Thames · borough labels</span>
      </header>
      <svg viewBox="0 0 200 140" className="w-full h-auto block" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="londonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(39, 39, 42, 0.6)" />
            <stop offset="100%" stopColor="rgba(24, 24, 27, 0)" />
          </radialGradient>
        </defs>

        {/* M25 outer ring (subtle) */}
        <ellipse
          cx="100" cy="78" rx="92" ry="60"
          fill="url(#londonGlow)"
          stroke="rgba(82, 82, 91, 0.3)"
          strokeWidth="0.4"
          strokeDasharray="1 2"
        />
        <text x="195" y="78" fontSize="3" fill="rgba(82, 82, 91, 0.7)" textAnchor="end" fontFamily="ui-monospace, monospace">M25</text>

        {/* Inner London core */}
        <ellipse
          cx="108" cy="78" rx="35" ry="22"
          fill="rgba(39, 39, 42, 0.4)"
          stroke="rgba(63, 63, 70, 0.5)"
          strokeWidth="0.3"
        />

        {/* Thames */}
        <path
          d="M 20 78 Q 50 72 75 80 Q 100 88 120 80 Q 145 72 180 92"
          fill="none"
          stroke="rgba(56, 189, 248, 0.55)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <text x="55" y="85" fontSize="2.5" fill="rgba(56, 189, 248, 0.7)" fontFamily="ui-monospace, monospace">Thames</text>

        {/* Flight corridors */}
        {/* Heathrow 27R/27L approach from east, planes land going west — depict approach from east */}
        <path
          d="M 195 75 Q 130 72 50 70"
          fill="none"
          stroke="rgba(245, 158, 11, 0.55)"
          strokeWidth="0.7"
          strokeDasharray="2.5 1.5"
        />
        <text x="38" y="68" fontSize="2.8" fill="rgba(245, 158, 11, 0.9)" fontFamily="ui-monospace, monospace">→ Heathrow</text>

        {/* City Airport approach from west */}
        <path
          d="M 5 95 Q 80 90 145 90"
          fill="none"
          stroke="rgba(245, 158, 11, 0.45)"
          strokeWidth="0.6"
          strokeDasharray="2 1.5"
        />
        <text x="148" y="92" fontSize="2.6" fill="rgba(245, 158, 11, 0.8)" fontFamily="ui-monospace, monospace">City →</text>

        {/* Stansted approach from south */}
        <path
          d="M 130 130 Q 135 100 140 65 Q 145 35 150 5"
          fill="none"
          stroke="rgba(245, 158, 11, 0.35)"
          strokeWidth="0.5"
          strokeDasharray="1.5 1.5"
        />
        <text x="152" y="20" fontSize="2.4" fill="rgba(245, 158, 11, 0.7)" fontFamily="ui-monospace, monospace">↑ Stansted</text>

        {/* Borough labels (subtle) */}
        {[
          ["Camden", 95, 60],
          ["Islington", 112, 62],
          ["Hackney", 122, 65],
          ["Hampstead", 95, 50],
          ["City", 116, 73],
          ["Tower H.", 128, 78],
          ["Westminster", 100, 79],
          ["Southwark", 116, 86],
          ["Greenwich", 138, 92],
          ["Lambeth", 108, 92],
          ["Wandsworth", 92, 96],
          ["Chelsea", 90, 86],
          ["Lewisham", 130, 96],
          ["Brent", 78, 58],
          ["Newham", 142, 72],
          ["Canary W.", 137, 87],
        ].map(([label, x, y]) => (
          <text
            key={label as string}
            x={x as number}
            y={y as number}
            fontSize="2.2"
            fill="rgba(113, 113, 122, 0.65)"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
          >
            {label}
          </text>
        ))}

        {/* Compass */}
        <g transform="translate(15, 20)">
          <text x="0" y="0" fontSize="3" fill="rgba(113, 113, 122, 0.6)" fontFamily="ui-monospace, monospace" textAnchor="middle">N</text>
          <line x1="0" y1="2" x2="0" y2="10" stroke="rgba(113, 113, 122, 0.5)" strokeWidth="0.4" />
        </g>

        {/* Postcode markers (last so they sit on top) */}
        {points.map((p, i) => (
          <g key={`${p.postcode}-${i}`}>
            <circle cx={p.pos.x} cy={p.pos.y} r="2.5" fill={p.color} opacity="0.4">
              <animate attributeName="r" from="2.5" to="7" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.55" to="0" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={p.pos.x} cy={p.pos.y} r="1.6" fill={p.color} stroke="rgba(0,0,0,0.6)" strokeWidth="0.3" />
            <text
              x={p.pos.x}
              y={p.pos.y - 4}
              fontSize="3.2"
              fill={p.color}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontWeight="bold"
              style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: "0.6px", strokeLinejoin: "round" }}
            >
              {p.postcode}
            </text>
          </g>
        ))}

        {/* Legend */}
        <g transform="translate(8, 132)">
          <line x1="0" y1="0" x2="6" y2="0" stroke="rgba(245, 158, 11, 0.7)" strokeWidth="0.6" strokeDasharray="2 1" />
          <text x="8" y="1" fontSize="2.5" fill="rgba(161, 161, 170, 0.8)" fontFamily="ui-monospace, monospace">flight path</text>
          <line x1="38" y1="0" x2="44" y2="0" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1.5" />
          <text x="46" y="1" fontSize="2.5" fill="rgba(161, 161, 170, 0.8)" fontFamily="ui-monospace, monospace">river thames</text>
        </g>
      </svg>
    </div>
  );
}
