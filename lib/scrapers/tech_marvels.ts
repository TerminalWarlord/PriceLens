import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { ProductProvider } from "../../types/product_type";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { uploadImage } from "../r2/upload_image";

export async function processProductUrl(productUrl: string) {
	try {
		const r = await proxyRequest(productUrl);
		const $ = cheerio.load(await r.data);
		const productName = $("h1.product_title").text().trim();
		const productImage = $("div.wd-carousel-item img").attr("src");
		let productDescription = "";
		for (const el of $(".woocommerce-product-details__short-description ul")
			.children()
			.toArray()) {
			productDescription += $(el).text().trim() + "\n";
		}
		const productPrice =
			Number(
				$('meta[property="product:price:amount"]').attr("content")?.trim(),
			) * 100;
		const isOutOfStock = $(".stock.out-of-stock.wd-style-bordered");
		if (isOutOfStock.length) {
			console.info(`Stock out ${productUrl}`);
			return;
		}
		console.log(productName, productImage, productDescription, productPrice);
		if (
			!productName ||
			!productImage ||
			!productDescription ||
			!productUrl ||
			isNaN(productPrice)
		) {
			return;
		}
		const item = await db
			.select()
			.from(productsTable)
			.where(
				and(
					eq(productsTable.product_url, productUrl),
					eq(productsTable.product_provider, ProductProvider.TECH_MARVELS),
				),
			);
		if (item && item.length) {
			return;
		}
		const uploadedImagePath = await uploadImage(
			productImage,
			ProductProvider.TECH_MARVELS,
		);
		const [result] = await db
			.insert(productsTable)
			.values({
				product_name: productName,
				product_url: productUrl,
				product_price: productPrice,
				product_description: productDescription.trim(),
				product_image: uploadedImagePath,
				product_provider: ProductProvider.TECH_MARVELS,
			})
			.returning({ id: productsTable.id });

		await db.insert(productPricesTable).values({
			name: productName,
			description: productDescription.trim(),
			price: productPrice,
			product_id: result.id,
			provider: ProductProvider.TECH_MARVELS,
		});
	} catch (err) {
		console.error(`Failed to process ${productUrl}: ${err}`);
	}
}

export async function getTechMarvelsProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const newUrl = `${url}page/${page}/?per_page=50`;
		console.info(`Page : ${page}`);
		try {
			console.info(`Scraping : ${newUrl}`);
			const r = await proxyRequest(newUrl);
			if (r.status >= 400) break;
			const $ = cheerio.load(await r.data);

			for (const el of $(".product-wrapper").toArray()) {
				const productUrl = $(el).find("a").attr("href");
				if (!productUrl) continue;
				console.log(`Getting details for : ${productUrl}`);
				await processProductUrl(productUrl);
			}
		} catch (err) {
			console.error(`Failed to scrape page ${page}: ${err}`);
		}
	}
}

export async function scrapeTechMarvelsCategories() {
	const r = await proxyRequest("https://techmarvels.com.bd/");
	const $ = cheerio.load(await r.data);
	for (const el of $("#menu-sticky-navigation-mega-electronics")
		.children()
		.toArray()) {
		const navLink = $(el).find("a").attr("href");
		if (!navLink) continue;
		await getTechMarvelsProductDetails(navLink);
		console.info(`Scraping : ${navLink}`);
	}
}
