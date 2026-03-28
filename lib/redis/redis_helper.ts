import { ProductProvider } from "../../types/product_type";
import { generateHash } from "../utils/hash_key";
import { redis_client } from "./redis_client";

export async function isCategoryProcessed(
	categoryUrl: string,
	provider: ProductProvider,
) {
	const key = `pricelens_queue:categories:${provider}`;
	const exists = await redis_client.sadd(key, categoryUrl);
	if (exists === 1) {
		const ttl = await redis_client.ttl(key);
		if (ttl === -1) {
			await redis_client.expire(key, 60 * 60 * 24 * 7);
		}
	}
	return exists === 1 ? false : true;
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
) {
	const exists = await redis_client.sadd("pricelens_queue:dedupe", productUrl);
	if (exists === 1) {
		await redis_client.lpush(
			`pricelens`,
			JSON.stringify({
				provider,
				productUrl,
			}),
		);
	} else {
		console.error(`${productUrl} already exists in the queue`);
	}
}

export async function flushSet() {
	await redis_client.del("pricelens_queue:dedupe");
}
