// Approximate overflight intensity by postcode district / area, derived from
// public CAA + HACAN flight path data. Intensity is on a 0–1 scale (1 = under
// a constant low-altitude approach corridor; 0 = effectively no overflights).
// Coarse on purpose - the demo lands on visibility, not precision.

type FlightProfile = {
  intensity: number;
  primaryCorridor: string;
  altitudeBand: string;
};

const FLIGHT_INTENSITY: Record<string, FlightProfile> = {
  // Heathrow approach (27R/27L) - runs through W London, peaks under W4/W6/W12
  W4: { intensity: 0.85, primaryCorridor: "Heathrow 27R approach", altitudeBand: "1,500–3,000 ft" },
  W6: { intensity: 0.8, primaryCorridor: "Heathrow 27R approach", altitudeBand: "2,000–3,500 ft" },
  W12: { intensity: 0.75, primaryCorridor: "Heathrow 27R approach", altitudeBand: "2,500–4,000 ft" },
  W14: { intensity: 0.7, primaryCorridor: "Heathrow 27R approach", altitudeBand: "3,000–4,500 ft" },
  W11: { intensity: 0.55, primaryCorridor: "Heathrow 27R approach", altitudeBand: "3,500–5,000 ft" },
  W2: { intensity: 0.45, primaryCorridor: "Heathrow approach overhead", altitudeBand: "4,500–6,000 ft" },
  W8: { intensity: 0.5, primaryCorridor: "Heathrow 27R approach", altitudeBand: "4,000–5,500 ft" },
  SW6: { intensity: 0.7, primaryCorridor: "Heathrow 27R approach", altitudeBand: "2,500–4,000 ft" },
  SW3: { intensity: 0.4, primaryCorridor: "Heathrow approach overhead", altitudeBand: "5,000–6,500 ft" },
  SW7: { intensity: 0.4, primaryCorridor: "Heathrow approach overhead", altitudeBand: "5,000–6,500 ft" },
  SW11: { intensity: 0.5, primaryCorridor: "Heathrow approach overhead", altitudeBand: "4,000–5,500 ft" },
  SW15: { intensity: 0.65, primaryCorridor: "Heathrow 27R approach", altitudeBand: "3,000–4,500 ft" },
  TW3: { intensity: 0.95, primaryCorridor: "Heathrow 27R immediate approach", altitudeBand: "500–1,500 ft" },
  TW9: { intensity: 0.9, primaryCorridor: "Heathrow 27R approach", altitudeBand: "1,000–2,500 ft" },

  // City Airport approach - runs along Thames east of Tower Bridge
  E14: { intensity: 0.65, primaryCorridor: "City Airport approach", altitudeBand: "1,500–2,500 ft" },
  E16: { intensity: 0.85, primaryCorridor: "City Airport immediate approach", altitudeBand: "500–1,500 ft" },
  SE10: { intensity: 0.5, primaryCorridor: "City Airport approach", altitudeBand: "2,000–3,000 ft" },
  SE16: { intensity: 0.55, primaryCorridor: "City Airport approach", altitudeBand: "2,000–3,000 ft" },
  SE8: { intensity: 0.45, primaryCorridor: "City Airport approach", altitudeBand: "2,500–3,500 ft" },
  SE18: { intensity: 0.4, primaryCorridor: "City Airport overhead", altitudeBand: "3,000–4,000 ft" },

  // Central - multiple holding stacks above 6000 ft, lower noise
  W1: { intensity: 0.4, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,000–8,000 ft" },
  WC1: { intensity: 0.35, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,500–8,500 ft" },
  WC2: { intensity: 0.35, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,500–8,500 ft" },
  EC1: { intensity: 0.35, primaryCorridor: "City Airport approach overhead", altitudeBand: "5,000–7,000 ft" },
  EC2: { intensity: 0.4, primaryCorridor: "City Airport approach overhead", altitudeBand: "4,500–6,500 ft" },
  EC3: { intensity: 0.45, primaryCorridor: "City Airport approach overhead", altitudeBand: "4,000–6,000 ft" },
  EC4: { intensity: 0.4, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "5,500–7,500 ft" },
  SW1: { intensity: 0.4, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,000–8,000 ft" },
  SE1: { intensity: 0.4, primaryCorridor: "City Airport approach overhead", altitudeBand: "5,000–7,000 ft" },
  SE11: { intensity: 0.35, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,000–8,000 ft" },

  // North London - low overflight, occasional Stansted departures
  N1: { intensity: 0.25, primaryCorridor: "Stansted departure overhead (occasional)", altitudeBand: "8,000+ ft" },
  N4: { intensity: 0.2, primaryCorridor: "Stansted/Luton overhead", altitudeBand: "8,000+ ft" },
  N6: { intensity: 0.15, primaryCorridor: "Stansted/Luton overhead", altitudeBand: "10,000+ ft" },
  N7: { intensity: 0.2, primaryCorridor: "Stansted overhead", altitudeBand: "9,000+ ft" },
  N16: { intensity: 0.25, primaryCorridor: "Stansted approach overhead", altitudeBand: "8,000+ ft" },
  N19: { intensity: 0.15, primaryCorridor: "Stansted/Luton overhead", altitudeBand: "10,000+ ft" },

  // NW London - Heathrow holding stack to the west
  NW1: { intensity: 0.3, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "7,000–9,000 ft" },
  NW3: { intensity: 0.3, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "7,000–9,000 ft" },
  NW5: { intensity: 0.25, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "8,000+ ft" },
  NW6: { intensity: 0.4, primaryCorridor: "Heathrow approach (high)", altitudeBand: "5,500–7,000 ft" },
  NW8: { intensity: 0.35, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,500–8,000 ft" },
  NW10: { intensity: 0.6, primaryCorridor: "Heathrow approach", altitudeBand: "4,000–5,500 ft" },

  // East - varies by City Airport runway direction
  E1: { intensity: 0.35, primaryCorridor: "City Airport overhead", altitudeBand: "5,000–6,500 ft" },
  E2: { intensity: 0.3, primaryCorridor: "City Airport overhead", altitudeBand: "5,500–7,000 ft" },
  E8: { intensity: 0.25, primaryCorridor: "Stansted approach overhead", altitudeBand: "7,000+ ft" },
  E15: { intensity: 0.45, primaryCorridor: "City Airport approach", altitudeBand: "3,500–5,000 ft" },
  E20: { intensity: 0.35, primaryCorridor: "City Airport approach", altitudeBand: "4,500–6,000 ft" },

  // SE - south of Thames, mostly clear
  SE15: { intensity: 0.2, primaryCorridor: "City Airport overhead", altitudeBand: "7,000+ ft" },
  SE17: { intensity: 0.25, primaryCorridor: "Heathrow holding overhead", altitudeBand: "7,000+ ft" },

  // SW outer
  SW8: { intensity: 0.4, primaryCorridor: "Heathrow approach overhead", altitudeBand: "5,500–7,000 ft" },
  SW9: { intensity: 0.35, primaryCorridor: "Heathrow approach overhead", altitudeBand: "5,500–7,000 ft" },
  SW17: { intensity: 0.55, primaryCorridor: "Heathrow approach", altitudeBand: "4,000–5,500 ft" },
  SW19: { intensity: 0.7, primaryCorridor: "Heathrow 27R approach", altitudeBand: "3,000–4,500 ft" },
};

const AREA_DEFAULT: Record<string, FlightProfile> = {
  N: { intensity: 0.2, primaryCorridor: "Stansted/Luton overhead", altitudeBand: "8,000+ ft" },
  NW: { intensity: 0.35, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,500–8,000 ft" },
  W: { intensity: 0.6, primaryCorridor: "Heathrow approach corridor", altitudeBand: "3,000–5,000 ft" },
  WC: { intensity: 0.35, primaryCorridor: "Heathrow holding stack overhead", altitudeBand: "6,500–8,500 ft" },
  EC: { intensity: 0.4, primaryCorridor: "City Airport approach overhead", altitudeBand: "4,500–6,500 ft" },
  E: { intensity: 0.4, primaryCorridor: "City Airport approach", altitudeBand: "4,000–6,000 ft" },
  SE: { intensity: 0.35, primaryCorridor: "City Airport overhead", altitudeBand: "5,000–7,000 ft" },
  SW: { intensity: 0.5, primaryCorridor: "Heathrow approach overhead", altitudeBand: "4,000–6,000 ft" },
  CR: { intensity: 0.45, primaryCorridor: "Heathrow/Gatwick overhead", altitudeBand: "5,000+ ft" },
  BR: { intensity: 0.4, primaryCorridor: "City Airport / Gatwick overhead", altitudeBand: "5,000+ ft" },
  HA: { intensity: 0.55, primaryCorridor: "Heathrow approach", altitudeBand: "4,000–5,500 ft" },
  KT: { intensity: 0.5, primaryCorridor: "Heathrow approach overhead", altitudeBand: "4,500–6,000 ft" },
  TW: { intensity: 0.85, primaryCorridor: "Heathrow immediate approach", altitudeBand: "1,000–2,500 ft" },
  EN: { intensity: 0.2, primaryCorridor: "Stansted/Luton overhead", altitudeBand: "8,000+ ft" },
};

export type FlightIntensity = FlightProfile & { postcode: string; resolvedFrom: "exact" | "area" | "default" };

export async function getFlightIntensity(postcode: string): Promise<FlightIntensity> {
  // Async signature so we match the other source-fetchers' shape, even though the lookup is sync.
  const key = postcode.trim().toUpperCase().replace(/\s+/g, "");
  if (FLIGHT_INTENSITY[key]) {
    return { postcode: key, ...FLIGHT_INTENSITY[key], resolvedFrom: "exact" };
  }
  const district = key.match(/^([A-Z]+\d+[A-Z]?)/);
  if (district && FLIGHT_INTENSITY[district[1]]) {
    return { postcode: key, ...FLIGHT_INTENSITY[district[1]], resolvedFrom: "exact" };
  }
  const areaMatch = key.match(/^([A-Z]+)/);
  if (areaMatch && AREA_DEFAULT[areaMatch[1]]) {
    return { postcode: key, ...AREA_DEFAULT[areaMatch[1]], resolvedFrom: "area" };
  }
  return {
    postcode: key,
    intensity: 0.3,
    primaryCorridor: "Mixed overhead corridors",
    altitudeBand: "varies",
    resolvedFrom: "default",
  };
}
