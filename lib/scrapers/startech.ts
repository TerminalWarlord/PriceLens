import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { ProductProvider } from "../../types/product_type";
import { and, eq } from "drizzle-orm";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { uploadImage } from "../r2/upload_image";
import { productPricesTable } from "../../src/db/schema/product_prices";

export async function getStartechProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		console.info(`Scraping page ${page}/${MAX_PAGE_LIMIT}...`);
		// filter_status=7 -> only shows in stock items
		const r = await proxyRequest(
			url + `?page=${page}&filter_status=7`,
			Method.GET,
		);
		const data = await r.data;
		const $ = cheerio.load(data);
		const items = $(".container").find(".p-item");

		if (items.length === 0) return;
		for (const el of items.children().toArray()) {
			try {
				const productImage = $(el).find("img").attr("src");
				const productDescription = $(el)
					.find(".short-description")
					.text()
					.trim();
				const productName = $(el).find(".p-item-name").find("a").text();
				const productUrl = $(el).find(".p-item-name").find("a").attr("href");
				// convert to paisa
				const productPrice =
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
					!productName ||
					!productImage ||
					!productDescription ||
					!productUrl ||
					isNaN(productPrice)
				) {
					continue;
				}
				const item = await db
					.select()
					.from(productsTable)
					.where(
						and(
							eq(productsTable.product_url, productUrl),
							eq(productsTable.product_provider, ProductProvider.STARTECH),
						),
					);
				if (item && item.length) {
					continue;
				}
				const uploadedImagePath = await uploadImage(
					productImage,
					ProductProvider.STARTECH,
				);
				const [result] = await db
					.insert(productsTable)
					.values({
						product_name: productName,
						product_url: productUrl,
						product_price: productPrice,
						product_description: productDescription.trim(),
						product_image: uploadedImagePath,
						product_provider: ProductProvider.STARTECH,
					})
					.returning({ id: productsTable.id });

				await db.insert(productPricesTable).values({
					name: productName,
					description: productDescription.trim(),
					price: productPrice,
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

export async function scrapeStartechCategories() {
	const url = "https://www.startech.com.bd/";
	const r = await proxyRequest(url, Method.GET);
	const data = await r.data;
	const $ = cheerio.load(data);
	const allMenu = $("ul.navbar-nav > li.nav-item");
	for (const el of allMenu.toArray()) {
		const navLink = $(el).children("a.nav-link").attr("href");
		console.info(`Scraping : ${navLink}`);
		if (!navLink) continue;
		await getStartechProductDetails(navLink);
	}
}
