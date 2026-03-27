import { meilisearch_client } from "./meilisearch_client";

export async function addSortingFilter() {
	await meilisearch_client
		.index("products")
		.updateSortableAttributes([
			"product_price",
			"product_provider",
			"created_at",
			"updated_at",
		]);
	await meilisearch_client
		.index("products")
		.updateFilterableAttributes(["product_price", "product_provider"]);
}

(async () => await addSortingFilter())();
