# SkyMate

> Adaptive Retrieval for UK postcodes. The agent re-PLANS its retrieval based on your profile - and shows you exactly how on screen.

Built for the **Cerebral Valley × MongoDB Agentic Evolution Hackathon** (London, 2 May 2026). Solo entry by [@billkhiz](https://github.com/billkhiz-bit).

---

## What it does

Type two UK postcodes (or borough names - "Hampstead", "Greenwich", "Shoreditch" all auto-resolve). Pick a profile:

- **Balanced** - equal weight on air, similarity, flight noise
- **Family with kids** - DEFRA-heavy, mention parks/quiet streets
- **Air quality first** - respiratory-sensitive, 0.95 weight on DEFRA
- **Quiet preferred** - Vector Search dominates, lean on similar peaceful neighbours
- **Avoid flight paths** - overflight intensity weight at 0.95

Click Compare. The agent fans out to:

1. **DEFRA UK-AIR** - live air quality from the 6 nearest monitoring stations
2. **Atlas Vector Search** - Titan v2 embeddings → top-3 similar postcodes from the seeded postcode collection
3. **Flight corridor lookup** - overflight intensity + primary corridor (Heathrow / City Airport / Stansted) from CAA + HACAN-derived data
4. **Bedrock Haiku 4.5 synthesiser** - using all three contexts + a profile-specific system prompt
5. **Verdict pass** (after both postcodes return) - a second Bedrock call for the one-sentence head-to-head

The decision trace shows every step with real ms timings and **animated weight bars**. Switching profiles visibly re-weights the bars - same query, different plan, different answer.

## Why this is not basic RAG

Basic RAG: one retriever, one synthesiser, fixed weights, no trace.

SkyMate: three retrievers selected by a router based on user profile, weights shifted dynamically per profile, trace exposed in the UI as proof. The agent **re-PLANS its retrieval, not just its prompt**. That's the hackathon theme - Adaptive Retrieval - made visible.

## Why MongoDB Atlas

One store doing three distinct jobs:

| Atlas primitive | Job | Surfaced as |
|---|---|---|
| **Vector Search** (`postcode_idx`, 1024 dim, cosine) | Similarity retrieval | Top-3 similar postcodes per query |
| **Time-series collection** (`air_quality`, timeField `ts`, metaField `postcode`) | Longitudinal evidence | Each query writes 6 DEFRA snapshots; aggregation pipeline (`$group + $avg`) returns a live London pollution heatmap |
| **Regular collection** (`query_log`) + cookie sessionId | Session memory | "Recently asked" strip persists across refreshes |

Most agentic apps need three different services for this. SkyMate uses one query model.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind v4**
- **MongoDB Atlas** (Sandbox project, eu-west-2) - Vector Search + Time-series + Aggregation Pipeline + Sessions
- **AWS Bedrock** - Anthropic Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) + Amazon Titan Embeddings v2
- **DEFRA UK-AIR** - public API for live air quality
- No client-side framework beyond React; no charting library; the London map is hand-rolled SVG

## Run locally

```bash
npm install
# Set up .env.local with:
#   MONGODB_URI=mongodb+srv://...
#   AWS_REGION=us-east-1
#   AWS_ACCESS_KEY_ID=...
#   AWS_SECRET_ACCESS_KEY=...
node scripts/embed-postcodes.mjs   # one-time: seed postcodes collection + embeddings
npm run dev
# open http://localhost:3000
```

You'll need:
- A MongoDB Atlas cluster (M0 or above) with a Vector Search index `postcode_idx` on `skymate.postcodes` (1024 dim, cosine, path `embedding`) and a time-series collection `skymate.air_quality` (timeField `ts`, metaField `postcode`, granularity `hours`)
- AWS IAM user with Bedrock invoke permissions on `anthropic.claude-haiku-4-5-*` and `amazon.titan-embed-text-v2:0`

## Try it

Click the **▶ demo seed** button at the top of the page - it fills the inputs with `Hampstead` vs `Greenwich`, sets the profile to `Family with kids`, and runs Compare in one click. Then switch the profile to `Avoid flight paths` and hit Compare again - watch the weight bars in the trace panel re-balance.

Click **◰ Show pollution heatmap** to see the aggregation-pipeline-backed map overlay of every postcode you've queried.

## License

MIT. Built during the hackathon window (10:30–17:00 BST, 2 May 2026).
