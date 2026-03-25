import { ProductProvider } from "../../types/product_type";
import { redis_client } from "./redis_client";

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
