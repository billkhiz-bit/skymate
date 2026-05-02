"use client";

type Pos = { x: number; y: number };

const POSTCODE_POSITIONS: Record<string, Pos> = {
  // viewBox is 200x140
  W1: { x: 100, y: 75 },
  WC1: { x: 105, y: 73 },
  WC2: { x: 105, y: 76 },
  EC1: { x: 113, y: 73 },
  EC2: { x: 115, y: 75 },
  EC3: { x: 117, y: 77 },
  EC4: { x: 113, y: 77 },
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
  N1: { x: 110, y: 65 },
  N4: { x: 113, y: 55 },
  N7: { x: 108, y: 58 },
  N16: { x: 118, y: 58 },
  N19: { x: 105, y: 53 },
  E1: { x: 125, y: 76 },
  E2: { x: 125, y: 72 },
  E8: { x: 125, y: 68 },
  E14: { x: 137, y: 84 },
  E15: { x: 140, y: 70 },
  E20: { x: 142, y: 65 },
  SE1: { x: 115, y: 82 },
  SE8: { x: 132, y: 88 },
  SE10: { x: 138, y: 88 },
  SE11: { x: 110, y: 86 },
  SE15: { x: 120, y: 95 },
  SE16: { x: 125, y: 85 },
  SE17: { x: 115, y: 88 },
  SE18: { x: 148, y: 92 },
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

const MARKER_COLORS = ["#0d9488", "#0284c7"]; // teal-600, sky-600 — strong contrast on light bg

// Flight corridor paths, named so we can hang animated planes off them
const FLIGHT_PATHS = {
  heathrow: "M 195 75 Q 130 72 50 70",
  city: "M 5 95 Q 80 90 145 90",
  stansted: "M 130 130 Q 135 100 140 65 Q 145 35 150 5",
};

export default function LondonMap({ postcodes }: { postcodes: string[] }) {
  const points = postcodes
    .map((p, i) => ({ postcode: p, pos: lookup(p), color: MARKER_COLORS[i % MARKER_COLORS.length] }))
    .filter((p): p is { postcode: string; pos: Pos; color: string } => p.pos !== null);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <header className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
        <h3 className="text-sm font-semibold tracking-wide text-slate-800">Greater London — postcode geometry</h3>
        <span className="text-xs text-slate-500 font-mono">live flight corridors · Thames · borough labels</span>
      </header>
      <svg viewBox="0 0 200 140" className="w-full h-auto block bg-gradient-to-b from-sky-50 via-white to-sky-50" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Plane silhouette pointing +x. animateMotion rotate="auto" makes it face direction of travel. */}
          <symbol id="plane" viewBox="-4 -3 9 6" overflow="visible">
            {/* Fuselage */}
            <ellipse cx="0" cy="0" rx="3.4" ry="0.7" fill="#0f172a" stroke="#020617" strokeWidth="0.12" />
            {/* Cockpit window */}
            <ellipse cx="2.4" cy="-0.05" rx="0.5" ry="0.25" fill="#7dd3fc" opacity="0.9" />
            {/* Top wing (swept back) */}
            <polygon points="0.6,-0.4 -1.7,-2.6 -2.4,-2.6 -1.4,-0.3" fill="#0f172a" stroke="#020617" strokeWidth="0.12" strokeLinejoin="round" />
            {/* Bottom wing (mirror) */}
            <polygon points="0.6,0.4 -1.7,2.6 -2.4,2.6 -1.4,0.3" fill="#0f172a" stroke="#020617" strokeWidth="0.12" strokeLinejoin="round" />
            {/* Top tail fin */}
            <polygon points="-2.6,-0.3 -3.5,-1.5 -3.85,-1.5 -2.95,-0.15" fill="#0f172a" stroke="#020617" strokeWidth="0.12" strokeLinejoin="round" />
            {/* Bottom tail fin (smaller — purely visual horizontal stabiliser) */}
            <polygon points="-2.6,0.3 -3.4,0.95 -3.7,0.95 -2.95,0.15" fill="#0f172a" stroke="#020617" strokeWidth="0.12" strokeLinejoin="round" />
            {/* Nose tip */}
            <polygon points="3.4,-0.45 3.85,0 3.4,0.45" fill="#020617" />
          </symbol>

          {/* Soft drop shadow for the plane */}
          <filter id="planeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.4" />
          </filter>

          {/* Park gradient — soft green */}
          <linearGradient id="park" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#86efac" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* M25 outer ring */}
        <ellipse
          cx="100" cy="78" rx="92" ry="60"
          fill="rgba(241, 245, 249, 0.5)"
          stroke="rgba(148, 163, 184, 0.5)"
          strokeWidth="0.5"
          strokeDasharray="1.5 2"
        />
        <text x="194" y="78" fontSize="3.2" fill="rgba(100, 116, 139, 0.85)" textAnchor="end" fontFamily="ui-monospace, monospace">M25</text>

        {/* Inner London core */}
        <ellipse
          cx="108" cy="78" rx="35" ry="22"
          fill="rgba(226, 232, 240, 0.45)"
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth="0.4"
        />

        {/* Major parks */}
        <ellipse cx="93" cy="50" rx="5" ry="3.2" fill="url(#park)" />
        <text x="93" y="51" fontSize="2" fill="#166534" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Hampstead Heath</text>

        <ellipse cx="100" cy="68" rx="3.5" ry="2" fill="url(#park)" />
        <text x="100" y="68.8" fontSize="1.8" fill="#166534" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Regent&apos;s Pk</text>

        <ellipse cx="93" cy="76" rx="4" ry="2" fill="url(#park)" />
        <text x="93" y="76.7" fontSize="1.8" fill="#166534" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Hyde Park</text>

        <ellipse cx="139" cy="89" rx="3.5" ry="2.2" fill="url(#park)" />
        <text x="139" y="89.7" fontSize="1.8" fill="#166534" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Greenwich Pk</text>

        <ellipse cx="98" cy="89" rx="2.2" ry="1.4" fill="url(#park)" />
        <text x="98" y="89.7" fontSize="1.6" fill="#166534" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Battersea</text>

        <ellipse cx="128" cy="70" rx="2.2" ry="1.4" fill="url(#park)" />
        <text x="128" y="70.6" fontSize="1.6" fill="#166534" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Victoria Pk</text>

        <ellipse cx="120" cy="62" rx="1.8" ry="1.2" fill="url(#park)" opacity="0.7" />

        {/* Thames */}
        <path
          d="M 20 78 Q 50 72 75 80 Q 100 88 120 80 Q 145 72 180 92"
          fill="none"
          stroke="#0284c7"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.85"
        />
        <text x="55" y="86" fontSize="2.8" fill="#0369a1" fontFamily="ui-monospace, monospace" fontWeight="600">Thames</text>

        {/* Flight corridors — paths */}
        <path id="path-heathrow" d={FLIGHT_PATHS.heathrow} fill="none" stroke="#d97706" strokeWidth="0.85" strokeDasharray="2.5 1.5" opacity="0.85" />
        <text x="40" y="68" fontSize="3" fill="#b45309" fontFamily="ui-monospace, monospace" fontWeight="600">→ Heathrow</text>

        <path id="path-city" d={FLIGHT_PATHS.city} fill="none" stroke="#d97706" strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.7" />
        <text x="148" y="93" fontSize="2.8" fill="#b45309" fontFamily="ui-monospace, monospace" fontWeight="600">City Airport →</text>

        <path id="path-stansted" d={FLIGHT_PATHS.stansted} fill="none" stroke="#d97706" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.55" />
        <text x="152" y="22" fontSize="2.6" fill="#b45309" fontFamily="ui-monospace, monospace" fontWeight="600">↑ Stansted</text>

        {/* Animated planes along each corridor */}
        <use href="#plane" width="6" height="3.6" x="-3" y="-1.8" filter="url(#planeShadow)">
          <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path={FLIGHT_PATHS.heathrow} />
        </use>
        <use href="#plane" width="6" height="3.6" x="-3" y="-1.8" filter="url(#planeShadow)">
          <animateMotion dur="11s" repeatCount="indefinite" rotate="auto" path={FLIGHT_PATHS.city} begin="2s" />
        </use>
        <use href="#plane" width="5" height="3" x="-2.5" y="-1.5" filter="url(#planeShadow)">
          <animateMotion dur="14s" repeatCount="indefinite" rotate="auto" path={FLIGHT_PATHS.stansted} begin="4s" />
        </use>

        {/* Airport markers (at the edges of the map where the corridors converge) */}
        <g>
          <rect x="40" y="68" width="6" height="4" fill="#1e293b" stroke="#020617" strokeWidth="0.2" rx="0.4" />
          <text x="43" y="71" fontSize="1.6" fill="#fbbf24" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="700">LHR</text>
          <text x="43" y="76" fontSize="2" fill="#1e293b" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">Heathrow</text>
        </g>
        <g>
          <rect x="146" y="88" width="6" height="4" fill="#1e293b" stroke="#020617" strokeWidth="0.2" rx="0.4" />
          <text x="149" y="91" fontSize="1.6" fill="#fbbf24" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="700">LCY</text>
          <text x="149" y="96" fontSize="2" fill="#1e293b" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">City</text>
        </g>

        {/* Borough labels */}
        {[
          ["Camden", 95, 60],
          ["Islington", 112, 62],
          ["Hackney", 122, 65],
          ["Hampstead", 95, 47],
          ["City", 116, 73],
          ["Tower H.", 130, 78],
          ["Westminster", 100, 80],
          ["Southwark", 116, 84],
          ["Greenwich", 137, 95],
          ["Lambeth", 107, 92],
          ["Wandsworth", 90, 100],
          ["Chelsea", 88, 86],
          ["Lewisham", 130, 100],
          ["Brent", 75, 56],
          ["Newham", 142, 70],
          ["Canary W.", 137, 86],
          ["Fulham", 80, 90],
          ["Kensington", 86, 78],
          ["Notting Hill", 86, 73],
          ["Shoreditch", 119, 70],
          ["Stratford", 144, 67],
          ["Peckham", 120, 96],
          ["Brixton", 105, 96],
          ["Wimbledon", 75, 113],
          ["Crystal Palace", 115, 110],
          ["Tottenham", 120, 50],
          ["Hammersmith", 78, 82],
          ["Putney", 80, 96],
          ["Holloway", 108, 56],
        ].map(([label, x, y]) => (
          <text
            key={label as string}
            x={x as number}
            y={y as number}
            fontSize="2.4"
            fill="#475569"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontWeight="500"
          >
            {label}
          </text>
        ))}

        {/* Compass */}
        <g transform="translate(15, 22)">
          <text x="0" y="0" fontSize="3.5" fill="#475569" fontFamily="ui-monospace, monospace" textAnchor="middle" fontWeight="600">N</text>
          <line x1="0" y1="2" x2="0" y2="11" stroke="#475569" strokeWidth="0.5" />
          <polygon points="0,12 -1.2,10 1.2,10" fill="#475569" />
        </g>

        {/* Postcode markers (last so they sit on top) */}
        {points.map((p, i) => (
          <g key={`${p.postcode}-${i}`}>
            <circle cx={p.pos.x} cy={p.pos.y} r="3" fill={p.color} opacity="0.35">
              <animate attributeName="r" from="3" to="8" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.55" to="0" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={p.pos.x} cy={p.pos.y} r="2" fill={p.color} stroke="white" strokeWidth="0.5" />
            <text
              x={p.pos.x}
              y={p.pos.y - 4.5}
              fontSize="3.6"
              fill={p.color}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              style={{ paintOrder: "stroke", stroke: "white", strokeWidth: "0.8px", strokeLinejoin: "round" }}
            >
              {p.postcode}
            </text>
          </g>
        ))}

        {/* Legend */}
        <g transform="translate(8, 134)">
          <use href="#plane" width="3.5" height="2.1" x="-1.75" y="-1" />
          <text x="3" y="0.8" fontSize="2.5" fill="#475569" fontFamily="ui-monospace, monospace">live flight</text>
          <line x1="22" y1="0" x2="28" y2="0" stroke="#d97706" strokeWidth="0.7" strokeDasharray="2 1.5" />
          <text x="29.5" y="0.8" fontSize="2.5" fill="#475569" fontFamily="ui-monospace, monospace">corridor</text>
          <line x1="48" y1="0" x2="54" y2="0" stroke="#0284c7" strokeWidth="1.5" />
          <text x="55.5" y="0.8" fontSize="2.5" fill="#475569" fontFamily="ui-monospace, monospace">river thames</text>
        </g>
      </svg>
    </div>
  );
}
