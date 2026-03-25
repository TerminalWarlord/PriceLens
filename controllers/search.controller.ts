import type { Context } from "hono";
import z from "zod";
import { meilisearch_client } from "../lib/meilisearch/meilisearch_client";
import { signDownloadUrl } from "../lib/r2/sign_download_image";
import { SortBy, type Product } from "../types/product_type";
import { redis_client } from "../lib/redis/redis_client";
import { generateHash } from "../lib/utils/hash_key";

export const getSearchController = async (c: Context) => {
	// TODO: add rate limits
	const schema = z.object({
		limit: z.coerce.number().min(1).max(20).default(20),
		offset: z.coerce.number().min(0).default(0),
		query: z.string().optional(),
		sortBy: z.enum(SortBy).default(SortBy.PRODUCT_PRICE),
		sortOrder: z.enum(["asc", "desc"]).default("asc"),
		// TODO: add provider filter in future
	});
	const parsedData = schema.safeParse({
		limit: c.req.query("limit"),
		offset: c.req.query("offset"),
		query: c.req.query("query"),
	});

	if (!parsedData.success) {
		return c.json(
			{
				message: "Invalid input!",
				errors: z.treeifyError(parsedData.error).errors,
			},
			400,
		);
	}
	const { offset, limit, sortBy, sortOrder, query } = parsedData.data;
	// Check for redis hit
	const cache_key =
		"pricelens_search:" +
		generateHash(`${query}:${limit}:${offset}:${sortBy}:${sortOrder}`);
	const redisHit = await redis_client.get(cache_key);
	if (redisHit) {
		console.info(`Cache hit!`);
		const data = JSON.parse(redisHit) as Product[];
		return c.json(
			data.map((item) => {
				const productImage = signDownloadUrl(item.product_image);
				return {
					...item,
					product_image: productImage,
				};
			}),
		);
	}
	const results = await meilisearch_client.index("products").search(query, {
		limit,
		offset,
		sort: [`${sortBy}:${sortOrder}`],
	});
	await redis_client.set(cache_key, JSON.stringify(results.hits), "EX", 300);
	const hits = await Promise.all(
		results.hits.map((item) => {
			const productImage = signDownloadUrl(item.product_image);
			return {
				...item,
				product_image: productImage,
			};
		}),
	);
	return c.json(hits);
};
