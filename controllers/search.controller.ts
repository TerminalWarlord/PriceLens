import type { Context } from "hono";
import z from "zod";
import { meilisearch_client } from "../lib/meilisearch/meilisearch_client";
import { signDownloadUrl } from "../lib/r2/sign_download_image";
import { SortBy } from "../types/product_type";

export const getSearchController = async (c: Context) => {
	// TODO: add rate limits and caching
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
	const results = await meilisearch_client.index("products").search(query, {
		limit,
		offset,
		sort: [`${sortBy}:${sortOrder}`],
	});

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
