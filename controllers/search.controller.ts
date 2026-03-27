import type { Context } from "hono";
import z from "zod";
import { meilisearch_client } from "../lib/meilisearch/meilisearch_client";
import { signDownloadUrl } from "../lib/r2/sign_download_image";
import { ProductProvider, SortBy, type Product } from "../types/product_type";
import { redis_client } from "../lib/redis/redis_client";
import { generateHash } from "../lib/utils/hash_key";

export const getSearchController = async (c: Context) => {
	const schema = z.object({
		limit: z.coerce.number().min(1).max(20).default(20),
		offset: z.coerce.number().min(0).default(0),
		query: z.string().optional(),
		sortBy: z.enum(SortBy).default(SortBy.PRODUCT_PRICE),
		sortOrder: z.enum(["ASC", "DESC"]).default("ASC"),
		minPrice: z.coerce.number().optional(),
		maxPrice: z.coerce.number().optional(),
		providers: z.array(z.enum(ProductProvider)).optional(),
	});
	const parsedData = schema.safeParse({
		limit: c.req.query("limit"),
		offset: c.req.query("offset"),
		query: c.req.query("query"),
		providers: c.req.queries("providers"),
		sortBy: c.req.query("sort_by"),
		sortOrder: c.req.query("sort_order"),
		minPrice: c.req.query("min_price"),
		maxPrice: c.req.query("max_price"),
	});

	if (!parsedData.success) {
		return c.json(
			{
				message: "Invalid input!",
				errors: z.treeifyError(parsedData.error).properties,
			},
			400,
		);
	}
	const {
		offset,
		limit,
		sortBy,
		sortOrder,
		query,
		providers,
		maxPrice,
		minPrice,
	} = parsedData.data;
	const sortedProviders = providers?.sort().join(",") ?? "";
	// Check for redis hit
	const cache_key =
		"pricelens_search:" +
		generateHash(
			`${query}:${limit}:${offset}:${sortBy}:${sortOrder}:${minPrice ?? ""}:${maxPrice ?? ""}:${sortedProviders}`,
		);
	const redisHit = await redis_client.get(cache_key);
	if (redisHit) {
		console.info(`Cache hit!`);
		const data = JSON.parse(redisHit) as {
			totalResults: number;
			hasNextPage: boolean;
			products: Product[];
		};
		return c.json({
			...data,
			products: data.products.map((item) => {
				const productImage = signDownloadUrl(item.product_image);
				return {
					...item,
					product_image: productImage,
				};
			}),
		});
	}
	const filters = [];
	if (minPrice) {
		filters.push(`product_price>=${minPrice * 100}`);
	}
	if (maxPrice) {
		filters.push(`product_price<=${maxPrice * 100}`);
	}
	if (providers?.length) {
		filters.push(
			`product_provider IN [${providers.map((p) => `"${p}"`).join(",")}]`,
		);
	}
	const results = await meilisearch_client.index("products").search(query, {
		offset,
		limit: limit + 1,
		sort: [`${sortBy}:${sortOrder.toLowerCase()}`],
		filter: filters.length ? filters.join(" AND ") : undefined,
	});
	await redis_client.set(
		cache_key,
		JSON.stringify({
			totalResults: results.estimatedTotalHits,
			hasNextPage: results.hits.length > limit,
			products: results.hits.slice(0, limit),
		}),
		"EX",
		300,
	);
	const hits = await Promise.all(
		results.hits.map((item) => {
			const productImage = signDownloadUrl(item.product_image);
			return {
				...item,
				product_image: productImage,
			};
		}),
	);
	return c.json({
		totalResults: results.estimatedTotalHits,
		hasNextPage: hits.length > limit,
		products: hits.slice(0, limit),
	});
};
