// Maps common London area names + boroughs to a representative postcode.
// Lookups are case-insensitive and ignore punctuation / "the" / "of" filler.

export const AREA_TO_POSTCODE: Record<string, string> = {
  // Boroughs (32 + City)
  "camden": "NW1",
  "westminster": "SW1",
  "city of westminster": "SW1",
  "city of london": "EC2",
  "the city": "EC2",
  "islington": "N1",
  "hackney": "E2",
  "tower hamlets": "E1",
  "southwark": "SE1",
  "lambeth": "SE11",
  "wandsworth": "SW18",
  "lewisham": "SE13",
  "greenwich": "SE10",
  "royal greenwich": "SE10",
  "newham": "E15",
  "waltham forest": "E17",
  "redbridge": "IG1",
  "havering": "RM1",
  "barking and dagenham": "RM8",
  "bexley": "DA5",
  "bromley": "BR1",
  "croydon": "CR0",
  "merton": "SW19",
  "kingston": "KT1",
  "kingston upon thames": "KT1",
  "richmond": "TW9",
  "richmond upon thames": "TW9",
  "hounslow": "TW3",
  "ealing": "W5",
  "hillingdon": "UB8",
  "harrow": "HA1",
  "brent": "NW10",
  "barnet": "EN5",
  "enfield": "EN1",
  "haringey": "N15",
  "kensington and chelsea": "SW3",
  "hammersmith and fulham": "W6",

  // Famous neighbourhoods
  "hampstead": "NW3",
  "highgate": "N6",
  "primrose hill": "NW1",
  "regents park": "NW1",
  "kentish town": "NW5",
  "kilburn": "NW6",
  "swiss cottage": "NW3",
  "st johns wood": "NW8",
  "marylebone": "W1",
  "soho": "W1",
  "mayfair": "W1",
  "fitzrovia": "W1",
  "bloomsbury": "WC1",
  "covent garden": "WC2",
  "holborn": "WC1",
  "clerkenwell": "EC1",
  "shoreditch": "EC2",
  "old street": "EC1",
  "barbican": "EC2",
  "liverpool street": "EC2",
  "bishopsgate": "EC2",
  "whitechapel": "E1",
  "spitalfields": "E1",
  "wapping": "E1",
  "bethnal green": "E2",
  "hoxton": "N1",
  "dalston": "E8",
  "stoke newington": "N16",
  "finsbury park": "N4",
  "holloway": "N7",
  "archway": "N19",
  "canary wharf": "E14",
  "isle of dogs": "E14",
  "stratford": "E15",
  "hackney wick": "E20",
  "olympic park": "E20",
  "bermondsey": "SE1",
  "borough": "SE1",
  "london bridge": "SE1",
  "deptford": "SE8",
  "rotherhithe": "SE16",
  "elephant and castle": "SE17",
  "kennington": "SE11",
  "vauxhall": "SE11",
  "peckham": "SE15",
  "new cross": "SE14",
  "woolwich": "SE18",
  "blackheath": "SE3",
  "victoria": "SW1",
  "pimlico": "SW1",
  "belgravia": "SW1",
  "knightsbridge": "SW1",
  "chelsea": "SW3",
  "south kensington": "SW7",
  "kensington": "W8",
  "notting hill": "W11",
  "paddington": "W2",
  "bayswater": "W2",
  "shepherds bush": "W12",
  "chiswick": "W4",
  "fulham": "SW6",
  "battersea": "SW11",
  "clapham": "SW4",
  "balham": "SW12",
  "tooting": "SW17",
  "wimbledon": "SW19",
  "putney": "SW15",
  "brixton": "SW9",
  "stockwell": "SW8",
};

function normalise(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .replace(/^the /, "")
    .replace(/ of /g, " ")
    .replace(/[.,]/g, "");
}

export type ResolveResult = {
  postcode: string;
  fromArea: boolean;
  areaName?: string;
};

export function resolveToPostcode(input: string): ResolveResult {
  const trimmed = input.trim();
  if (!trimmed) return { postcode: "", fromArea: false };

  // If it already looks like a postcode (letters + digits), pass through uppercase
  if (/^[A-Za-z]{1,2}\d/.test(trimmed)) {
    return { postcode: trimmed.toUpperCase().replace(/\s+/g, ""), fromArea: false };
  }

  // Try area lookup
  const key = normalise(trimmed);
  if (AREA_TO_POSTCODE[key]) {
    return {
      postcode: AREA_TO_POSTCODE[key],
      fromArea: true,
      areaName: trimmed.replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }

  // Fallback: treat as raw postcode (uppercase)
  return { postcode: trimmed.toUpperCase().replace(/\s+/g, ""), fromArea: false };
}
