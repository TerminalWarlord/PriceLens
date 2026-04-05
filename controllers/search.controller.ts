import type { Context } from "hono";
import z from "zod";
import { meilisearch_client } from "../lib/meilisearch/meilisearch_client";
import { signDownloadUrl } from "../lib/r2/sign_download_image";
import { ProductProvider, SortBy, type Product } from "../types/product_type";
import { redis_client } from "../lib/redis/redis_client";
import { generateHash } from "../lib/utils/hash_key";
import { get24hrsChange } from "../lib/utils/get_24hrs_change";

export const getSearchController = async (c: Context) => {
	const schema = z.object({
		limit: z.coerce.number().min(1).max(20).default(10),
		offset: z.coerce.number().min(0).default(0),
		query: z.string().optional(),
		sortBy: z.enum(SortBy).default(SortBy.RELEVANCE),
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
			products: await Promise.all(
				data.products.map(async (item) => {
					const productImage = signDownloadUrl(item.product_image);
					return {
						...item,
						product_price: item.product_price.toString(),
						product_image: productImage,
					};
				}),
			),
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
	const sortOptions =
		sortBy === SortBy.RELEVANCE
			? undefined
			: [`${sortBy}:${sortOrder.toLowerCase()}`];
	const results = await meilisearch_client.index("products").search(query, {
		offset,
		limit: limit + 1,
		sort: sortOptions,
		filter: filters.length ? filters.join(" AND ") : undefined,
	});
	await redis_client.set(
		cache_key,
		JSON.stringify({
			totalResults: results.estimatedTotalHits,
			hasNextPage: results.hits.length > limit,
			products: await Promise.all(
				results.hits.slice(0, limit).map(async (product) => {
					const priceChange = await get24hrsChange(product.id);
					return {
						...product,
						product_price: product.product_price.toString(),
						product_change: priceChange.toString(),
					};
				}),
			),
		}),
		"EX",
		300,
	);
	const hits = await Promise.all(
		results.hits.map(async (item) => {
			const productImage = signDownloadUrl(item.product_image);
			const priceChange = await get24hrsChange(item.id);
			return {
				...item,
				product_price: item.product_price.toString(),
				price_change: priceChange.toString(),
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
