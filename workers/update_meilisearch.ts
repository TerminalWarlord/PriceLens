import { addSortingFilter } from "../lib/meilisearch/add_filters";
import { deleteIndex } from "../lib/meilisearch/delete_index";
import { indexProducts } from "../lib/meilisearch/index_products";

async function updateMeilisearch() {
	await deleteIndex();
	await addSortingFilter();
	await indexProducts();
}

await updateMeilisearch();
