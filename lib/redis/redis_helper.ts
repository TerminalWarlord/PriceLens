import { ProductProvider } from "../../types/product_type";
import { generateHash } from "../utils/hash_key";
import { redis_client } from "./redis_client";

export async function isCategoryProcessed(
	categoryUrl: string,
	provider: ProductProvider,
) {
	const key = `pricelens_queue:categories:${provider}`;
	return redis_client.sismember(key, categoryUrl);
}

export async function markCategoryAsProcessed(
	categoryUrl: string,
	provider: ProductProvider,
) {
	const key = `pricelens_queue:categories:${provider}`;
	const exists = await redis_client.sadd(key, categoryUrl);
	if (exists === 1) {
		const ttl = await redis_client.ttl(key);
		if (ttl === -1) {
			await redis_client.expire(key, 60 * 60 * 4);
		}
	}
	return exists === 1 ? false : true;
}
export async function setTtlOnQueue(
	ttl: number = 60 * 60 * 24,
	key: string = "pricelens_queue",
) {
	await redis_client.expire(key + ":dedupe", ttl);
	await redis_client.expire(key, ttl);
}
export async function isPageProcessed(pageUrl: string) {
	const key = `pricelens:pages:${generateHash(pageUrl)}`;
	return await redis_client.get(key);
}

export async function markPageAsProcessed(pageUrl: string) {
	const key = `pricelens:pages:${generateHash(pageUrl)}`;
	return await redis_client.set(key, "1", "EX", 900);
}

export async function addItemToQueue(
	productUrl: string,
	provider: ProductProvider,
	categoryId?: number,
	key: string = "pricelens_queue",
) {
	const exists = await redis_client.sadd(`${key}:dedupe`, productUrl);

	if (exists === 1) {
		await redis_client.lpush(
			key,
			JSON.stringify({
				provider,
				productUrl,
				categoryId,
			}),
		);
	} else {
		console.error(`${productUrl} already exists in the queue`);
	}
}

export async function flushQueueAndSet(key: string = "pricelens_queue") {
	await redis_client.del(`${key}`);
	await redis_client.del(`${key}:dedupe`);
}
