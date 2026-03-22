import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { ProductProvider } from "../../types/product_type";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { and, eq } from "drizzle-orm";
import { MAX_PAGE_LIMIT } from "./scraper_config";

export async function getStartechProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		console.info(`Scraping page ${page}/${MAX_PAGE_LIMIT}...`);
		const r = await proxyRequest(url + `?page=${page}`, Method.GET);
		const data = await r.data;
		const $ = cheerio.load(data);
		const items = $(".container").find(".p-item");

		if (items.length === 0) return;
		for (const el of items.children().toArray()) {
			try {
				const product_image = $(el).find("img").attr("src");
				const product_description = $(el)
					.find(".short-description")
					.text()
					.trim();
				const product_name = $(el).find(".p-item-name").find("a").text();
				const product_url = $(el).find(".p-item-name").find("a").attr("href");
				// convert to paisa
				const product_price =
					Number(
						$(el)
							.find(".p-item-price")
							.find("span")
							.first()
							.text()
							.trim()
							.replace(/৳/g, "")
							.replace(/,/g, ""),
					) * 100;
				if (
					!product_name ||
					!product_image ||
					!product_description ||
					!product_name ||
					!product_url ||
					isNaN(product_price)
				) {
					continue;
				}
				const item = await db
					.select()
					.from(productsTable)
					.where(
						and(
							eq(productsTable.product_url, product_url),
							eq(productsTable.product_provider, ProductProvider.STARTECH),
						),
					);
				if (item && item.length) {
					continue;
				}
				const [result] = await db
					.insert(productsTable)
					.values({
						product_name,
						product_url,
						product_price,
						product_description,
						product_image,
						product_provider: ProductProvider.STARTECH,
					})
					.returning({ id: productsTable.id });

				await db.insert(productPricesTable).values({
					name: product_name,
					description: product_description,
					price: product_price,
					product_id: result.id,
					provider: ProductProvider.STARTECH,
				});
			} catch (err) {
				console.error(err);
			}
		}
		console.log(items.length);
	}
}

export async function getStartechCategories() {
	const url = "https://www.startech.com.bd/";
	const r = await proxyRequest(url, Method.GET);
	const data = await r.data;
	const $ = cheerio.load(data);
	const allMenu = $("ul.navbar-nav > li.nav-item");
	for (const el of allMenu.toArray()) {
		const navLink = $(el).children("a.nav-link").attr("href");
		console.info(`Scraping : ${navLink}`);
		if (!navLink) return;
		await getStartechProductDetails(navLink);
		return;
	}
}
