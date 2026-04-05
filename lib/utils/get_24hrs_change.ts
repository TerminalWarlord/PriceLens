import { eq, sql } from "drizzle-orm";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { db } from "../db";
import { redis_client } from "../redis/redis_client";

export async function get24hrsChange(productId: number) {
	const key = `pricelens_product_price_24hrs_change:${productId}`;
	const cache = await redis_client.get(key);
	if (cache) {
		return cache;
	}
	const result = await db
		.select({
			price: productPricesTable.price,
		})
		.from(productPricesTable)
		.where(eq(productPricesTable.product_id, productId))
		.groupBy(productPricesTable.recorded_at, productPricesTable.id)
		.orderBy(sql`${productPricesTable.recorded_at} desc`)
		.limit(2);
	let priceChange = 0n;
	if (result && result.length > 1) {
		priceChange = result[1].price - result[0].price;
	}
	await redis_client.set(key, priceChange.toString(), "EX", 300);
	return priceChange;
}
