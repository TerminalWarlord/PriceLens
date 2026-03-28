import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { MAX_PAGE_LIMIT, PLIMIT } from "./scraper_config";
import {
	consoleError,
	consoleInfo,
	consoleLogProduct,
	consoleSuccess,
} from "./debugger";
import { ProductProvider } from "../../types/product_type";
import {
	addItemToQueue,
	isCategoryProcessed,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { productsTable } from "../../src/db/schema/products";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "../r2/upload_image";
import pLimit from "p-limit";
import { processItemWithTimeout } from "../utils/process_helper";

const BASE_URL = "https://www.ucc.com.bd";

export async function processUCCProductUrl(productUrl: string) {
	consoleInfo(ProductProvider.UCC, `Scraping ${productUrl}`);
	try {
		const r = await proxyRequest(productUrl);
		if (r.status !== 200) {
			consoleError(ProductProvider.UCC, `Failed to fetch ${productUrl}`);
		}
		const $ = cheerio.load(r.data);
		const productName = $("#product div.title.page-title").text().trim();
		const productPrice =
			Number(
				$("div.price-group div")
					.eq(0)
					.text()
					.trim()
					.replace(/,/g, "")
					.replace(/৳/g, ""),
			) * 100;
		const productImage = $(".product-left img").eq(0).attr("src");
		let productDescription = "";
		for (const el of $(".short_description_product-page ul")
			.children()
			.toArray()) {
			productDescription += $(el).text().trim() + "\n";
		}
		if (
			!productName ||
			!productImage ||
			!productDescription ||
			!productUrl ||
			isNaN(productPrice) ||
			productPrice === 0
		) {
			consoleError(ProductProvider.UCC, `${productUrl} is missing metadata`);
			return;
		}
		consoleLogProduct(ProductProvider.UCC, {
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
					eq(productsTable.product_provider, ProductProvider.UCC),
				),
			);
		if (item && item.length) {
			return;
		}
		const uploadedImagePath = await uploadImage(
			productImage,
			ProductProvider.UCC,
		);

		const [result] = await db
			.insert(productsTable)
			.values({
				product_name: productName,
				product_url: productUrl,
				product_price: BigInt(productPrice),
				product_description: productDescription.trim(),
				product_image: uploadedImagePath,
				product_provider: ProductProvider.UCC,
			})
			.returning({ id: productsTable.id });

		await db.insert(productPricesTable).values({
			name: productName,
			description: productDescription.trim(),
			price: BigInt(productPrice),
			product_id: result.id,
			provider: ProductProvider.UCC,
		});
	} catch (err) {
		console.log(err);
	}
}

async function getUCCProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		try {
			const pageUrl = `${url}?fq=1&limit=100&page=${page}`;
			if (await isPageProcessed(pageUrl)) {
				consoleError(ProductProvider.UCC, `Already processed : ${pageUrl}`);
				continue;
			}
			const r = await proxyRequest(pageUrl);
			if (r.status != 200) {
				continue;
			}
			const $ = cheerio.load(r.data);

			const productUrls = [];
			for (const el of $(".product-thumb").toArray()) {
				const productUrl = $(el).find("a.product-img").attr("href");
				if (!productUrl) continue;
				const u = new URL(productUrl);
				productUrls.push(BASE_URL + u.pathname);
			}
			if (productUrls.length === 0) {
				consoleError(ProductProvider.UCC, `No more items left ${pageUrl}`);
				continue;
			}

			let processed = 0;
			for (const productUrl of productUrls) {
				try {
					await addItemToQueue(productUrl, ProductProvider.UCC);
					processed += 1;
				} catch (err) {
					consoleError(
						ProductProvider.UCC,
						`Failed to add item to the queue ${productUrl}: ${err}`,
					);
				}
			}
			if (processed === productUrls.length) {
				await markPageAsProcessed(pageUrl);
			}
		} catch (err) {
			consoleError(ProductProvider.UCC, `Failed to process ${page}: ${err}`);
		}
	}
}

export async function scrapeUCCCategories() {
	try {
		const r = await proxyRequest("https://www.ucc.com.bd/");
		const $ = cheerio.load(r.data);

		const navLinks = new Set<string>();
		for (const el of $(".flyout-menu ul.j-menu").children().toArray()) {
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
						ProductProvider.UCC,
					);
					if (isProcessed) return;
					consoleInfo(ProductProvider.UCC, `Scraping : ${navLink}`);
					await processItemWithTimeout(
						getUCCProductDetails(navLink),
						100 * 300,
					);
				} catch (err) {
					consoleError(ProductProvider.UCC, `Failed to scrape ${err}`);
				}
			}),
		);
		await Promise.all(tasks);
		consoleSuccess(ProductProvider.UCC, `Processed all categories`);
	} catch (err) {
		console.log(err);
	}
}
