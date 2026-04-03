import { and, eq } from "drizzle-orm";
import { categoriesTable } from "../../src/db/schema/product_categories";
import { ProductProvider } from "../../types/product_type";
import { db } from "../db";
import { consoleError, consoleSuccess } from "../scrapers/debugger";
import { proxyRequest } from "../utils/proxy_request";
import * as cheerio from "cheerio";
import { getCategoryFromProvider } from "../scrapers/category_selectors";

export async function addCategory(
	slug: string,
	name: string,
	provider: ProductProvider,
) {
	try {
		const [category] = await db
			.select({
				id: categoriesTable.id,
			})
			.from(categoriesTable)
			.where(
				and(
					eq(categoriesTable.provider_category_slug, slug),
					eq(categoriesTable.provider, provider),
				),
			);
		if (category) {
			return category.id;
		}
		const [newCategory] = await db
			.insert(categoriesTable)
			.values({
				name,
				provider,
				provider_category_slug: slug,
				pricelens_slug: slug,
			})
			.returning({ id: categoriesTable.id });
		if (newCategory) {
			consoleSuccess(provider, `Created new category ${name}`);
			return newCategory.id;
		}
	} catch (err) {
		console.error(`Failed to create category : ${err} `);
	}
}

export async function getCategory(url: string, provider: ProductProvider) {
	try {
		const r = await proxyRequest(url);
		if (r.status !== 200) {
			consoleError(provider, `Failed to fetch category`);
			return;
		}
		const $ = cheerio.load(r.data);
		const categoryName = getCategoryFromProvider(provider, $);
		if (categoryName) {
			return await addCategory(url, categoryName, provider);
		}
		console.log({ categoryName });
	} catch (err) {
		consoleError(provider, `Failed to extract category ${url} : ${err}`);
	}
}

// (async () => await getCategory("https://www.ucc.com.bd/laptops?fq=1", ProductProvider.UCC))();
