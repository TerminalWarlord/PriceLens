import { meilisearch_client } from "./meilisearch_client";

export async function deleteIndex() {
	const task = await meilisearch_client.deleteIndex("products");
	await meilisearch_client.tasks.waitForTask(task.taskUid, { timeout: 10000 });
}
