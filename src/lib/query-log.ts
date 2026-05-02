import { getDb } from "@/lib/mongodb";

export type QueryLogEntry = {
  sessionId: string;
  postcode: string;
  preference: string;
  summaryPreview: string;
  ts: Date;
};

const COLLECTION = "query_log";

export async function appendQuery(entry: QueryLogEntry): Promise<void> {
  try {
    const db = await getDb();
    await db.collection<QueryLogEntry>(COLLECTION).insertOne(entry);
  } catch (err) {
    // Non-fatal - never break the user's response over a logging failure.
    console.warn("[query-log] insert failed:", err);
  }
}

export async function getRecentQueries(sessionId: string, limit = 5): Promise<QueryLogEntry[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection<QueryLogEntry>(COLLECTION)
      .find({ sessionId })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();
    return docs;
  } catch (err) {
    console.warn("[query-log] read failed:", err);
    return [];
  }
}
