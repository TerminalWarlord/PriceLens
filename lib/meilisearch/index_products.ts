import { sql } from "drizzle-orm";
import { productsTable } from "../../src/db/schema/products";
import { db } from "../db";
import { meilisearch_client } from "./meilisearch_client";

const BATCH = 1000;
export async function indexProducts() {
	let offset = 0;
	while (true) {
		const results = await db
			.select()
			.from(productsTable)
			.offset(offset)
			.limit(BATCH)
			.orderBy(sql`${productsTable.product_name} asc`);
		if (!results || !results.length) break;
		// https://www.meilisearch.com/docs/getting_started/sdks/javascript
		await meilisearch_client.index("products").addDocuments(results);
		console.info(`Processed ${Math.round(offset / BATCH) + 1}`);
		offset += BATCH;
	}
}

(async () => {
	await indexProducts();
})();
