import { MeiliSearch } from "meilisearch";

declare global {
	var meilisearch_client: MeiliSearch | undefined;
}

export const meilisearch_client =
	globalThis.meilisearch_client ??
	new MeiliSearch({
		host: process.env.MEILISEARCH_URL!,
		apiKey: process.env.MEILI_MASTER_KEY!,
	});

if (process.env.NODE_ENV !== "production") {
	globalThis.meilisearch_client = meilisearch_client;
}
