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
