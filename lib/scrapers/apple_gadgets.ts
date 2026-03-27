import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../utils/proxy_request";
import { MAX_PAGE_LIMIT, PLIMIT } from "./scraper_config";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { ProductProvider } from "../../types/product_type";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { uploadImage } from "../r2/upload_image";
import {
	consoleError,
	consoleInfo,
	consoleLogProduct,
	consoleSuccess,
} from "./debugger";
import pLimit from "p-limit";
import {
	addItemToQueue,
	isCategoryProcessed,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";

const BASE_URL = "https://www.applegadgetsbd.com";

export async function processAppleGadgetsProductUrl(productUrl: string) {
	try {
		const updatedProductUrl = productUrl.includes("https://")
			? productUrl
			: BASE_URL + productUrl;
		consoleInfo(
			ProductProvider.APPLE_GADGETS,
			`Scraping: ${updatedProductUrl}`,
		);
		const r = await proxyRequest(updatedProductUrl);
		const data = await r.data;
		const $ = cheerio.load(data);
		const productImage = $('meta[property="og:image"]')
			.attr("content")
			?.replace("/large/", "/medium/");
		const productName = $("main section h1").text();
		const priceMatch = data.match(
			/\\"variants\\"[\s\S]*?\\"price\\"\s*:\s*\{\\"value\\"\s*:\s*(\d+)/,
		);
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
			!updatedProductUrl ||
			isNaN(productPrice) ||
			productPrice === 0
		) {
			consoleError(
				ProductProvider.APPLE_GADGETS,
				`${productUrl} is missing metadata`,
			);
			return;
		}
		consoleLogProduct(ProductProvider.APPLE_GADGETS, {
			name: productName,
			description: productDescription.trim(),
			image: productImage,
			price: productPrice,
		});
		const item = await db
			.select()
			.from(productsTable)
			.where(
				and(
					eq(productsTable.product_url, updatedProductUrl),
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
				product_url: updatedProductUrl,
				product_price: BigInt(productPrice),
				product_description: productDescription.trim(),
				product_image: uploadedImagePath,
				product_provider: ProductProvider.APPLE_GADGETS,
			})
			.returning({ id: productsTable.id });

		await db.insert(productPricesTable).values({
			name: productName,
			description: productDescription.trim(),
			price: BigInt(productPrice),
			product_id: result.id,
			provider: ProductProvider.APPLE_GADGETS,
		});
		consoleSuccess(ProductProvider.APPLE_GADGETS, `Added ${updatedProductUrl}`);
	} catch (err) {
		consoleError(
			ProductProvider.APPLE_GADGETS,
			`Failed to add ${productUrl} : ${err}`,
		);
	}
}

export async function getAppleGadgetsProductDetails(url: string) {
	// https://www.applegadgetsbd.com/category/laptop-and-desktop?page=2
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const pageUrl = url + "?page=" + page;
		if (await isPageProcessed(pageUrl)) {
			consoleError(
				ProductProvider.APPLE_GADGETS,
				`Already processed : ${pageUrl}`,
			);
			continue;
		}
		const r = await proxyRequest(pageUrl, Method.GET, 40000);
		if (r.status >= 400) break;
		const $ = cheerio.load(await r.data);
		const productUrls = [];
		for (const el of $("article").toArray()) {
			const productUrl = $(el).find("a").first().attr("href");
			if (!productUrl) continue;
			productUrls.push(BASE_URL + productUrl);
		}

		if (productUrls.length === 0) {
			consoleError(
				ProductProvider.APPLE_GADGETS,
				`No items found on ${pageUrl}`,
			);
			return;
		}
		let processed = 0;
		for (const productUrl of productUrls) {
			try {
				await addItemToQueue(productUrl, ProductProvider.APPLE_GADGETS);
				processed += 1;
			} catch (err) {
				consoleError(
					ProductProvider.APPLE_GADGETS,
					`Failed to add item to the queue ${productUrl}: ${err}`,
				);
			}
		}
		if (processed === productUrls.length) {
			await markPageAsProcessed(pageUrl);
		}
	}
}

export async function scrapeAppleGadgetsCategories() {
	try {
		const r = await proxyRequest("https://www.applegadgetsbd.com/");
		const $ = cheerio.load(await r.data);
		const navLinks = new Set<string>();
		for (const el of $("a").toArray()) {
			const navLink = BASE_URL + $(el).attr("href");
			if (!navLink) continue;
			if (navLink.includes("/category/") || navLink.includes("/brand/")) {
				navLinks.add(navLink);
			}
		}
		const categoryLimit = pLimit(PLIMIT);
		const tasks = Array.from(navLinks).map((navLink) =>
			categoryLimit(async () => {
				try {
					const isProcessed = await isCategoryProcessed(
						navLink,
						ProductProvider.APPLE_GADGETS,
					);
					if (isProcessed) return;
					consoleInfo(ProductProvider.APPLE_GADGETS, `Scraping : ${navLink}`);
					await getAppleGadgetsProductDetails(navLink);
				} catch (err) {
					consoleError(
						ProductProvider.APPLE_GADGETS,
						`Failed to scrape ${err}`,
					);
				}
			}),
		);

		await Promise.all(tasks);
		consoleSuccess(ProductProvider.APPLE_GADGETS, `Processed all categories`);
	} catch (err) {
		consoleError(ProductProvider.APPLE_GADGETS, `Failed to scrape ${err}`);
	}
}
