// One-shot seed: call Titan v2 for each postcode and upsert into skymate.postcodes.
// MCP insert-many cannot carry 6 × 1024-dim embeddings inline (~131 KB), so we use the driver here.
// Usage: node scripts/embed-postcodes.mjs
import { readFileSync } from "node:fs";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { MongoClient } from "mongodb";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const TITAN = "amazon.titan-embed-text-v2:0";
const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });

const SEED = [
  { postcode: "NW3", name: "Hampstead", description: "Leafy north London with Heath access, Georgian terraces, and a calm village feel; popular with families and creatives." },
  { postcode: "SE10", name: "Greenwich", description: "Historic riverside neighbourhood with the maritime museum and park; mix of Georgian streets and dense newer developments by the Thames." },
  { postcode: "E14", name: "Canary Wharf / Isle of Dogs", description: "High-rise financial district with new-build flats, dockside walkways, and weekday office crowds; quieter and more residential at weekends." },
  { postcode: "SW1", name: "Westminster", description: "Central London core with government buildings, royal parks, and grand white-stucco terraces; high prestige, very busy on weekdays." },
  { postcode: "N1", name: "Islington", description: "Vibrant inner-north area with Georgian squares, the canal, and a long restaurant strip on Upper Street; lively but residential." },
  { postcode: "W1", name: "West End", description: "Central retail and entertainment core including Soho, Mayfair, and Marylebone; densely built, heavy footfall, and very mixed-use." },
];

async function embed(text) {
  const resp = await client.send(new InvokeModelCommand({
    modelId: TITAN,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
  }));
  const decoded = JSON.parse(new TextDecoder().decode(resp.body));
  if (!Array.isArray(decoded.embedding) || decoded.embedding.length !== 1024) {
    throw new Error(`Bad embedding shape for: ${text.slice(0, 40)}`);
  }
  return decoded.embedding;
}

const docs = [];
for (const row of SEED) {
  const embedding = await embed(`${row.postcode} ${row.name}: ${row.description}`);
  docs.push({ postcode: row.postcode, name: row.name, description: row.description, embedding });
  process.stderr.write(`embedded ${row.postcode}\n`);
}

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();
const coll = mongo.db("skymate").collection("postcodes");
const placeholderResult = await coll.deleteMany({ _placeholder: true });
process.stderr.write(`deleted ${placeholderResult.deletedCount} placeholder doc(s)\n`);
for (const doc of docs) {
  await coll.replaceOne({ postcode: doc.postcode }, doc, { upsert: true });
  process.stderr.write(`upserted ${doc.postcode}\n`);
}
await mongo.close();
process.stderr.write("done\n");
