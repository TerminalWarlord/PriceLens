import { proxyRequest } from "../utils/proxy_request";
import * as cheerio from "cheerio";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { ProductProvider } from "../../types/product_type";
import { productsTable } from "../../src/db/schema/products";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "../r2/upload_image";

export async function getComputerVillageProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const r = await proxyRequest(`${url}?limit=200&page=${page}&fq=1`);
		const $ = cheerio.load(await r.data);
		for (const el of $(".main-products.product-grid").children().toArray()) {
			try {
				const productName = $(el).find(".caption .name").text();
				const productUrl = $(el).find(".caption .name a").attr("href");
				const productPrice =
					Number(
						$(el)
							.find(".price div span")
							.eq(0)
							.text()
							.replace(/,/g, "")
							.replace(/৳/g, "")
							.trim(),
					) * 100;
				let productDescription = "";
				for (const li of $(el)
					.find(".module-features-description ul")
					.children()
					.toArray()) {
					productDescription += $(li).text() + "\n";
				}
				const productImage = $(el).find(".image img").attr("src");
				console.log(productPrice, productImage);
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
							eq(
								productsTable.product_provider,
								ProductProvider.COMPUTER_VILLAGE,
							),
						),
					);
				if (item && item.length) {
					continue;
				}
				const uploadedImagePath = await uploadImage(
					productImage,
					ProductProvider.COMPUTER_VILLAGE,
				);
				const [result] = await db
					.insert(productsTable)
					.values({
						product_name: productName,
						product_url: productUrl,
						product_price: productPrice,
						product_description: productDescription,
						product_image: uploadedImagePath,
						product_provider: ProductProvider.COMPUTER_VILLAGE,
					})
					.returning({ id: productsTable.id });

				await db.insert(productPricesTable).values({
					name: productName,
					description: productDescription,
					price: productPrice,
					product_id: result.id,
					provider: ProductProvider.COMPUTER_VILLAGE,
				});
			} catch (err) {
				console.error(`Failed to store current item : ${err}`);
			}
		}
	}
}

export async function scrapeComputerVillageCategories() {
	const r = await proxyRequest("https://www.computervillage.com.bd/");
	const $ = cheerio.load(await r.data);
	for (const el of $(".main-menu .j-menu").children().toArray()) {
		const navLink = $(el).find("a").attr("href");
		if (!navLink) continue;
		console.info(`Scraping : ${navLink}`);
		await getComputerVillageProductDetails(navLink);
	}
}
