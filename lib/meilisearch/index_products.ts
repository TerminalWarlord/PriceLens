import { sql } from "drizzle-orm";
import { productsTable } from "../../src/db/schema/products";
import { db } from "../db";
import { meilisearch_client } from "./meilisearch_client";

const BATCH = 500;
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
		const updatedResults = results.map((item) => {
			return {
				...item,
				product_price: Number(item.product_price),
			};
		});
		// https://www.meilisearch.com/docs/getting_started/sdks/javascript
		const task = await meilisearch_client
			.index("products")
			.addDocuments(updatedResults);
		await meilisearch_client.tasks.waitForTask(task.taskUid, {
			timeout: 10000,
		});
		console.info(`Processed ${Math.round(offset / BATCH) + 1}`);
		offset += BATCH;
	}
}
