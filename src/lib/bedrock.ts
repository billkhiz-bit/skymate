import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const HAIKU_4_5 = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const TITAN_EMBED_V2 = "amazon.titan-embed-text-v2:0";
const TITAN_DIMENSIONS = 1024;

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export type BedrockResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
};

export async function callHaiku(systemPrompt: string, userPrompt: string): Promise<BedrockResult> {
  const response = await client.send(
    new ConverseCommand({
      modelId: HAIKU_4_5,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0.3 },
    }),
  );

  const text = response.output?.message?.content?.[0]?.text ?? "";
  if (!response.usage) {
    throw new Error("Bedrock response missing usage block — sham implementation guard tripped");
  }

  return {
    text,
    inputTokens: response.usage.inputTokens ?? 0,
    outputTokens: response.usage.outputTokens ?? 0,
    modelId: HAIKU_4_5,
  };
}

export type TitanEmbedResult = {
  embedding: number[];
  inputTextTokenCount: number;
  modelId: string;
};

export async function callTitanEmbed(text: string): Promise<TitanEmbedResult> {
  const response = await client.send(
    new InvokeModelCommand({
      modelId: TITAN_EMBED_V2,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: text,
        dimensions: TITAN_DIMENSIONS,
        normalize: true,
      }),
    }),
  );

  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  const embedding: number[] = decoded.embedding;

  if (!Array.isArray(embedding) || embedding.length !== TITAN_DIMENSIONS) {
    throw new Error(
      `Titan returned unexpected embedding shape: length=${embedding?.length}, expected=${TITAN_DIMENSIONS}`,
    );
  }

  return {
    embedding,
    inputTextTokenCount: decoded.inputTextTokenCount ?? 0,
    modelId: TITAN_EMBED_V2,
  };
}

// ---------------------------------------------------------------------------
// Intent decomposer — turns natural-language housing concerns into a JSON
// retrieval plan. This is the layer that makes adaptive retrieval truly
// agentic: the model infers source weights from raw text, rather than the
// user picking a pre-built profile.
// ---------------------------------------------------------------------------

export type IntentDecomposition = {
  defraWeight: number;
  vectorWeight: number;
  flightWeight: number;
  focus: string;
  reasoning: string;
};

const DECOMPOSER_SYSTEM =
  "You are a retrieval router for a UK housing intelligence agent. Given a natural-language description of someone's housing concerns, output a JSON object with weight numbers (0-1) and a brief reasoning. Output ONLY a single JSON object - no markdown, no code fences, no preamble.";

function clamp01(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export async function decomposeIntent(intent: string): Promise<IntentDecomposition | null> {
  const userPrompt = [
    `User description: "${intent.slice(0, 400)}"`,
    "",
    "Output a JSON object with this exact shape:",
    "{",
    '  "defraWeight": <number 0-1>,',
    '  "vectorWeight": <number 0-1>,',
    '  "flightWeight": <number 0-1>,',
    '  "focus": "<one of: air | noise | family | similarity | mixed>",',
    '  "reasoning": "<one short sentence explaining the weights>"',
    "}",
    "",
    "Weight meanings:",
    "- defraWeight: how much DEFRA air-quality data should drive the answer",
    "- vectorWeight: how much similar-postcode discovery via Atlas Vector Search matters",
    "- flightWeight: how much overhead aircraft noise matters",
    "",
    "Inferences you should make:",
    '- "asthmatic" / "lung condition" / "respiratory" -> boost defra (0.85+)',
    '- "young children" / "kids" / "babies" -> boost defra (0.7+) AND flight (0.5+)',
    '- "night shift" / "shift worker" / "I sleep during the day" -> boost flight (0.8+)',
    '- "love peace and quiet" / "introvert" -> boost flight (0.6+) AND vector (0.6+)',
    '- "find me somewhere like NW3" / "similar to" -> boost vector (0.85+)',
    '- "I don\'t really know" / vague -> balanced (0.5 each)',
    "",
    "Output JSON now (no other text):",
  ].join("\n");

  try {
    const result = await callHaiku(DECOMPOSER_SYSTEM, userPrompt);
    let text = result.text.trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));

    return {
      defraWeight: clamp01(parsed.defraWeight),
      vectorWeight: clamp01(parsed.vectorWeight),
      flightWeight: clamp01(parsed.flightWeight),
      focus: typeof parsed.focus === "string" ? parsed.focus : "mixed",
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
          ? parsed.reasoning
          : "Inferred from user intent.",
    };
  } catch (err) {
    console.warn("[decomposeIntent] failed:", err);
    return null;
  }
}
