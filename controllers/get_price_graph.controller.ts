import type { Context } from "hono";
import z from "zod";
import { db } from "../src";
import { productPricesTable } from "../src/db/schema/product_prices";
import { eq, sql } from "drizzle-orm";
import { redis_client } from "../lib/redis/redis_client";

export const getPriceGraph = async (c: Context) => {
	const schema = z.coerce.number();
	const parsedData = schema.safeParse(c.req.query("product_id"));
	if (!parsedData.success) {
		return c.json({
			message: "Invalid input",
			error: z.treeifyError(parsedData.error).errors,
		});
	}
	const productId = parsedData.data;
	const key = `pricelens_product_price_change:${productId}`;
	const cache = await redis_client.get(key);
	if (cache) {
		return c.json(JSON.parse(cache));
	}
	const results = await db
		.select({
			value: sql`price::text`,
			label: productPricesTable.recorded_at,
		})
		.from(productPricesTable)
		.where(eq(productPricesTable.product_id, parsedData.data))
		.groupBy(productPricesTable.id, productPricesTable.recorded_at)
		.orderBy(sql`recorded_at DESC`)
		.limit(30);
	await redis_client.set(key, JSON.stringify(results), "EX", 300);
	return c.json({
		results: results,
	});
};
