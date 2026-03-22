import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";

declare global {
	var db: NodePgDatabase | undefined;
}

export const db = globalThis.db ?? drizzle(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
	globalThis.db = db;
}
