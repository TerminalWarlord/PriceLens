import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { ProductProvider } from "../../types/product_type";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { uploadImage } from "../r2/upload_image";

const BASE_URL = "https://www.applegadgetsbd.com";

async function processProductUrl(productUrl: string) {
	const r = await proxyRequest(productUrl);
	const data = await r.data;
	const $ = cheerio.load(data);
	const productImage = $('meta[property="og:image"]')
		.attr("content")
		?.replace("/large/", "/medium/");
	const productName = $("main section h1").text();
	const priceMatch = data.match(/\\"price\\"\s*:\s*\{\\"value\\"\s*:\s*(\d+)/);
	let productDescription = "";
	for (const el of $("#tabSpecification table tbody").children()) {
		const fieldTitle = $(el).find("td").eq(0).text();
		const fieldValue = $(el).find("td").eq(1).text();
		productDescription += `${fieldTitle}: ${fieldValue}\n`;
	}
	const productPrice = Number(priceMatch?.[1]) * 100;
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
				eq(productsTable.product_provider, ProductProvider.APPLE_GADGETS),
			),
		);
	if (item && item.length) {
		return;
	}
	const uploadedImagePath = await uploadImage(
		productImage,
		ProductProvider.APPLE_GADGETS,
	);
	const [result] = await db
		.insert(productsTable)
		.values({
			product_name: productName,
			product_url: productUrl,
			product_price: productPrice,
			product_description: productDescription.trim(),
			product_image: uploadedImagePath,
			product_provider: ProductProvider.APPLE_GADGETS,
		})
		.returning({ id: productsTable.id });

	await db.insert(productPricesTable).values({
		name: productName,
		description: productDescription.trim(),
		price: productPrice,
		product_id: result.id,
		provider: ProductProvider.APPLE_GADGETS,
	});

	console.log(productPrice, productDescription);
}

export async function getAppleGadgetsProductDetails(url: string) {
	// https://www.applegadgetsbd.com/category/laptop-and-desktop?page=2
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const r = await proxyRequest(url + "?page=" + page);
		const productUrls: string[] = [];
		const $ = cheerio.load(await r.data);
		for (const el of $("article").toArray()) {
			const item = $(el).find("a").first().attr("href");
			if (!item) continue;
			productUrls.push(item);
		}

		for (const productUrl of productUrls) {
			try {
				console.info(`Scraping: ${productUrl}`);
				await processProductUrl(BASE_URL + productUrl);
				break;
			} catch (err) {
				console.error(`Failed to scrape ${productUrl}: ${err}`);
			}
		}
	}
}

export async function scrapeAppleGadgetsCategories() {
	const r = await proxyRequest("https://www.applegadgetsbd.com/");
	const $ = cheerio.load(await r.data);
	for (const el of $("nav").find("a").toArray()) {
		const navLink = BASE_URL + $(el).attr("href");
		if (!navLink) continue;
		await getAppleGadgetsProductDetails(navLink);
	}
}
