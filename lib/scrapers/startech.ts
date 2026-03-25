import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { ProductProvider } from "../../types/product_type";
import { and, eq } from "drizzle-orm";
import { MAX_PAGE_LIMIT, PLIMIT } from "./scraper_config";
import { uploadImage } from "../r2/upload_image";
import { productPricesTable } from "../../src/db/schema/product_prices";
import {
	consoleError,
	consoleInfo,
	consoleLogProduct,
	consoleSuccess,
} from "./debugger";
import pLimit from "p-limit";
import { addItemToQueue, isCategoryProcessed } from "../redis/redis_helper";

export async function processStartechProductUrl(productUrl: string) {
	consoleInfo(ProductProvider.STARTECH, `Scraping ${productUrl}`);
	const r = await proxyRequest(productUrl);
	const data = r.data;
	const $ = cheerio.load(data);
	const productName = $("h1.product-name").text().trim();
	const productPrice =
		Number(
			$("table.product-info-table tbody")
				.find(".product-info-data.product-price")
				.text()
				.trim()
				.replace(/,/g, "")
				.replace(/৳/g, ""),
		) * 100;
	const productImage = $("img.main-img").attr("src");
	let productDescription = "";
	for (const el of $("div.short-description ul").children().toArray()) {
		if ($(el).hasClass("view-more")) continue;
		productDescription += $(el).text().trim() + "\n";
	}
	productDescription = productDescription.trim();
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
				eq(productsTable.product_provider, ProductProvider.STARTECH),
			),
		);
	if (item && item.length) {
		return;
	}
	const uploadedImagePath = await uploadImage(
		productImage,
		ProductProvider.STARTECH,
	);
	consoleLogProduct(ProductProvider.STARTECH, {
		name: productName,
		description: productDescription.trim(),
		image: productImage,
		price: productPrice,
	});
	const [result] = await db
		.insert(productsTable)
		.values({
			product_name: productName,
			product_url: productUrl,
			product_price: BigInt(productPrice),
			product_description: productDescription.trim(),
			product_image: uploadedImagePath,
			product_provider: ProductProvider.STARTECH,
		})
		.returning({ id: productsTable.id });

	await db.insert(productPricesTable).values({
		name: productName,
		description: productDescription.trim(),
		price: BigInt(productPrice),
		product_id: result.id,
		provider: ProductProvider.STARTECH,
	});
	consoleSuccess(ProductProvider.STARTECH, `Added ${productUrl}`);
}

export async function getStartechProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		consoleInfo(
			ProductProvider.STARTECH,
			`Scraping page ${page}/${MAX_PAGE_LIMIT}...`,
		);
		// filter_status=7 -> only shows in stock items
		const pageUrl = url + `?page=${page}&filter_status=7`;
		const r = await proxyRequest(pageUrl);
		const data = await r.data;
		const $ = cheerio.load(data);
		const items = $(".container").find(".p-item");

		if (items.length === 0) {
			consoleError(
				ProductProvider.STARTECH,
				`No more items found on page ${pageUrl}`,
			);
			return;
		}
		for (const el of items.children().toArray()) {
			const productUrl = $(el).find(".p-item-name").find("a").attr("href");
			if (!productUrl) continue;
			try {
				await addItemToQueue(productUrl, ProductProvider.STARTECH);
			} catch (err) {
				consoleError(
					ProductProvider.STARTECH,
					`Failed to add ${productUrl} : ${err}`,
				);
			}
		}
	}
}

export async function scrapeStartechCategories() {
	try {
		const url = "https://www.startech.com.bd/";
		const r = await proxyRequest(url, Method.GET);
		const data = await r.data;
		const $ = cheerio.load(data);
		const navLinks = new Set<string>();
		for (const el of $("a.nav-link").toArray()) {
			const navLink = $(el).attr("href");
			if (!navLink) continue;
			navLinks.add(navLink);
		}
		const categoryLimit = pLimit(PLIMIT);
		const tasks = Array.from(navLinks).map((navLink) =>
			categoryLimit(async () => {
				try {
					const isProcessed = await isCategoryProcessed(
						navLink,
						ProductProvider.STARTECH,
					);
					if (isProcessed) return;
					consoleInfo(ProductProvider.STARTECH, `Scraping : ${navLink}`);
					await getStartechProductDetails(navLink);
				} catch (err) {
					consoleError(ProductProvider.STARTECH, `Failed to scrape ${err}`);
				}
			}),
		);
		await Promise.all(tasks);
		consoleSuccess(
			ProductProvider.STARTECH,
			"Finished scraping all Startech categories.",
		);
	} catch (err) {
		consoleError(ProductProvider.STARTECH, `Failed to scrape ${err}`);
	}
}
