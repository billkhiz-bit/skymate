import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI not set in environment");
}

let cached: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> {
  if (!cached) {
    cached = new MongoClient(uri!).connect();
  }
  return cached;
}

export async function getDb(name = "skymate"): Promise<Db> {
  const client = await getClient();
  return client.db(name);
}
