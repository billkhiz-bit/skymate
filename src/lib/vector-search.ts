import { getDb } from "@/lib/mongodb";

export type SimilarPostcode = {
  postcode: string;
  name: string;
  description: string;
  score: number;
};

export async function findSimilarPostcodes(
  embedding: number[],
  excludePostcode?: string,
  limit = 3,
): Promise<SimilarPostcode[]> {
  const db = await getDb();
  const cursor = db.collection("postcodes").aggregate<SimilarPostcode>([
    {
      $vectorSearch: {
        index: "postcode_idx",
        path: "embedding",
        queryVector: embedding,
        numCandidates: 50,
        limit: limit + (excludePostcode ? 1 : 0),
      },
    },
    {
      $project: {
        _id: 0,
        postcode: 1,
        name: 1,
        description: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  const results = await cursor.toArray();
  const filtered = excludePostcode
    ? results.filter((r) => r.postcode !== excludePostcode)
    : results;
  return filtered.slice(0, limit);
}
