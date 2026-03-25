import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { ProductProvider } from "../../types/product_type";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { MAX_PAGE_LIMIT, PLIMIT } from "./scraper_config";
import { uploadImage } from "../r2/upload_image";
import {
	consoleError,
	consoleInfo,
	consoleLogProduct,
	consoleSuccess,
} from "./debugger";
import {
	addItemToQueue,
	isCategoryProcessed,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import pLimit from "p-limit";

export async function processTechMarvelsProductUrl(productUrl: string) {
	try {
		consoleInfo(ProductProvider.TECH_MARVELS, `Scraping : ${productUrl}`);
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
			consoleError(ProductProvider.TECH_MARVELS, `Stock out ${productUrl}`);
			return;
		}
		if (
			!productName ||
			!productImage ||
			!productDescription ||
			!productUrl ||
			isNaN(productPrice)
		) {
			return;
		}
		consoleLogProduct(ProductProvider.TECH_MARVELS, {
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
				product_price: BigInt(productPrice),
				product_description: productDescription.trim(),
				product_image: uploadedImagePath,
				product_provider: ProductProvider.TECH_MARVELS,
			})
			.returning({ id: productsTable.id });

		await db.insert(productPricesTable).values({
			name: productName,
			description: productDescription.trim(),
			price: BigInt(productPrice),
			product_id: result.id,
			provider: ProductProvider.TECH_MARVELS,
		});
	} catch (err) {
		consoleError(
			ProductProvider.TECH_MARVELS,
			`Failed to process ${productUrl}: ${err}`,
		);
	}
}

export async function getTechMarvelsProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const pageUrl = `${url}page/${page}/?per_page=50`;
		consoleInfo(ProductProvider.TECH_MARVELS, `Page : ${page}`);
		try {
			if (await isPageProcessed(pageUrl)) {
				consoleError(
					ProductProvider.TECH_MARVELS,
					`Already processed : ${pageUrl}`,
				);
				continue;
			}
			consoleInfo(ProductProvider.TECH_MARVELS, `Scraping : ${pageUrl}`);
			const r = await proxyRequest(pageUrl);
			if (r.status >= 400) break;
			const $ = cheerio.load(await r.data);
			const productUrls = [];
			for (const el of $(".product-wrapper").toArray()) {
				const productUrl = $(el).find("a").attr("href");
				if (!productUrl) continue;
				productUrls.push(productUrl);
			}
			if (productUrls.length === 0) {
				consoleError(
					ProductProvider.TECH_MARVELS,
					`No items found on ${pageUrl}`,
				);
				return;
			}
			let processed = 0;
			for (const productUrl of productUrls) {
				try {
					await addItemToQueue(productUrl, ProductProvider.TECH_MARVELS);
					processed += 1;
				} catch (err) {
					consoleError(
						ProductProvider.TECH_MARVELS,
						`Failed to add item to the queue ${[productUrl]}: ${err}`,
					);
				}
			}
			if (processed === productUrls.length) {
				await markPageAsProcessed(pageUrl);
			}
		} catch (err) {
			consoleError(
				ProductProvider.TECH_MARVELS,
				`Failed to scrape page ${page}: ${err}`,
			);
		}
	}
}

export async function scrapeTechMarvelsCategories() {
	try {
		const r = await proxyRequest("https://techmarvels.com.bd/");
		const $ = cheerio.load(await r.data);
		const navLinks = new Set<string>();
		for (const el of $("#menu-sticky-navigation-mega-electronics")
			.children()
			.toArray()) {
			const navLink = $(el).find("a").attr("href");
			if (!navLink) continue;
			navLinks.add(navLink);
		}
		const categoryLimit = pLimit(PLIMIT);
		const tasks = Array.from(navLinks).map((navLink) =>
			categoryLimit(async () => {
				try {
					const isProcessed = await isCategoryProcessed(
						navLink,
						ProductProvider.TECH_MARVELS,
					);
					if (isProcessed) return;
					consoleInfo(ProductProvider.TECH_MARVELS, `Scraping : ${navLink}`);
					await getTechMarvelsProductDetails(navLink);
				} catch (err) {
					consoleError(ProductProvider.TECH_MARVELS, `Failed to scrape ${err}`);
				}
			}),
		);
		await Promise.all(tasks);
		consoleSuccess(ProductProvider.TECH_MARVELS, `Processed all categories`);
	} catch (err) {
		consoleError(ProductProvider.TECH_MARVELS, `Failed to scrape ${err}`);
	}
}
