import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  eyemapDb?: Db;
  eyemapSql?: ReturnType<typeof postgres>;
};

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 10,
  });
  return drizzle(client, { schema });
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (!globalForDb.eyemapDb) {
      globalForDb.eyemapDb = createDb();
    }
    return Reflect.get(globalForDb.eyemapDb, prop, receiver);
  },
});
