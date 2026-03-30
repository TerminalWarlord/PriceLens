import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { consoleError, consoleInfo, consoleLogProduct } from "./debugger";
import { ProductProvider } from "../../types/product_type";
import { addProduct } from "./add_product";
import { db } from "../db";
import { categoriesTable } from "../../src/db/schema/product_categories";
import { and, eq } from "drizzle-orm";
import { processCategories } from "./process_categories";
import { isPageProcessed, markPageAsProcessed } from "../redis/redis_helper";
import { MAX_PAGE_LIMIT } from "./scraper_config";

async function getCategory(url: string) {
	try {
		const r = await proxyRequest(url);
		if (r.status !== 200) {
			throw new Error("Failed to get category");
		}
		const $ = cheerio.load(r.data);
		const categoryName = $("ul.breadcrumb li").last().text().trim();
		const [result] = await db
			.select()
			.from(categoriesTable)
			.where(
				and(
					eq(categoriesTable.provider_category_slug, url),
					eq(categoriesTable.provider, ProductProvider.SKYLANDBD),
				),
			)
			.limit(1);
		if (result) {
			return result.id;
		}
		const [newCategory] = await db
			.insert(categoriesTable)
			.values({
				name: categoryName,
				pricelens_slug: url,
				provider: ProductProvider.SKYLANDBD,
				provider_category_slug: url,
			})
			.returning({ id: categoriesTable.id });
		if (!newCategory) {
			throw new Error("Failed to create category!");
		}
		return newCategory.id;
	} catch (err) {
		consoleError(
			ProductProvider.SKYLANDBD,
			`Failed to get category ${url}: ${err}`,
		);
	}
}

async function processSkylandProduct(url: string) {
	const categoryId = await getCategory(url);
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const pageUrl = `${url}/?limit=100&fq=1&page=${page}`;
		consoleInfo(ProductProvider.SKYLANDBD, `Scrapping ${pageUrl}...`);
		try {
			if (await isPageProcessed(pageUrl)) {
				continue;
			}
			const r = await proxyRequest(pageUrl);
			if (r.status !== 200) {
				consoleInfo(
					ProductProvider.SKYLANDBD,
					`No more items found ${pageUrl}`,
				);
				break;
			}
			const $ = cheerio.load(r.data);
			if ($("div.main-products").children().length === 0) {
				consoleInfo(
					ProductProvider.SKYLANDBD,
					`No more items found on ${pageUrl}`,
				);
				break;
			}
			for (const el of $("div.main-products").children().toArray()) {
				try {
					const productName = $(el).find("div.name a").attr("title")?.trim();
					const productUrl = $(el).find("a").attr("href")?.trim();
					const productImage =
						"https://www.skyland.com.bd/" +
						$(el).find("div.image img").eq(0).attr("src");
					const productPrice =
						Number(
							$(el)
								.find("div.price span")
								.eq(0)
								.text()
								.replace(/,/g, "")
								.replace(/৳/g, "")
								.trim(),
						) * 100;
					let productDescription = "";
					for (const li of $(el)
						.find("div.key-features ul")
						.children()
						.toArray()) {
						productDescription += $(li).text().trim();
					}
					await addProduct({
						category_id: categoryId,
						product_description: productDescription,
						product_image: productImage,
						product_price: productPrice,
						product_name: productName,
						product_provider: ProductProvider.SKYLANDBD,
						product_url: productUrl,
					});
				} catch (err) {
					consoleError(
						ProductProvider.SKYLANDBD,
						`Failed to extract product data!`,
					);
				}
			}
			await markPageAsProcessed(pageUrl);
		} catch (err) {
			consoleError(
				ProductProvider.SKYLANDBD,
				`Failed to process ${pageUrl}: ${err}`,
			);
		}
	}
}
export async function scrapeSkylandBdCategories() {
	const r = await proxyRequest("https://www.skyland.com.bd/");
	if (r.status !== 200) {
		throw new Error("Failed to get categories");
	}
	const $ = cheerio.load(r.data);
	const navLinks = new Set<string>();
	for (const el of $(".j-menu a").toArray()) {
		const navLink = $(el).attr("href");
		if (!navLink || !navLink.startsWith("https://")) {
			continue;
		}
		navLinks.add(navLink);
	}
	await processCategories(
		navLinks,
		ProductProvider.SKYLANDBD,
		processSkylandProduct,
	);
}

(async () => await scrapeSkylandBdCategories())();
