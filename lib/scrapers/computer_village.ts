import { proxyRequest } from "../utils/proxy_request";
import * as cheerio from "cheerio";
import { MAX_PAGE_LIMIT, PLIMIT } from "./scraper_config";
import { ProductProvider } from "../../types/product_type";
import { productsTable } from "../../src/db/schema/products";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "../r2/upload_image";
import {
	consoleError,
	consoleInfo,
	consoleLogProduct,
	consoleSuccess,
} from "./debugger";
import { addItemToQueue, isCategoryProcessed } from "../redis/redis_helper";
import pLimit from "p-limit";

export async function processComputerVillageProductUrl(productUrl: string) {
	try {
		const r = await proxyRequest(productUrl);
		const $ = cheerio.load(r.data);
		const productName = $("#product .title.page-title").text().trim();
		const productPrice =
			Number(
				$(".short-info .product-mpn.product-data")
					.eq(0)
					.find("span")
					.eq(1)
					.text()
					.trim()
					.replace(/,/g, "")
					.replace(/৳/g, ""),
			) * 100;
		let productDescription = "";
		for (const el of $(".module-features-description ul").toArray()) {
			productDescription += $(el).text().trim() + "\n";
		}
		productDescription = productDescription.trim();
		const productImage = $(".product-image img").first().attr("src");
		if (
			!productName ||
			!productImage ||
			!productDescription ||
			!productUrl ||
			isNaN(productPrice)
		) {
			consoleError(
				ProductProvider.COMPUTER_VILLAGE,
				`${productUrl} missing metadata!`,
			);
			return;
		}
		consoleLogProduct(ProductProvider.COMPUTER_VILLAGE, {
			name: productName,
			description: productDescription,
			image: productImage,
			price: productPrice,
		});
		const item = await db
			.select()
			.from(productsTable)
			.where(
				and(
					eq(productsTable.product_url, productUrl),
					eq(productsTable.product_provider, ProductProvider.COMPUTER_VILLAGE),
				),
			);
		if (item && item.length) {
			consoleError(ProductProvider.COMPUTER_VILLAGE, `${productUrl} exists`);
			return;
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
				product_price: BigInt(productPrice),
				product_description: productDescription.trim(),
				product_image: uploadedImagePath,
				product_provider: ProductProvider.COMPUTER_VILLAGE,
			})
			.returning({ id: productsTable.id });

		await db.insert(productPricesTable).values({
			name: productName,
			description: productDescription.trim(),
			price: BigInt(productPrice),
			product_id: result.id,
			provider: ProductProvider.COMPUTER_VILLAGE,
		});
		consoleSuccess(ProductProvider.COMPUTER_VILLAGE, `Added ${productUrl}`);
	} catch (err) {
		consoleError(
			ProductProvider.COMPUTER_VILLAGE,
			`Failed to add ${productUrl}: ${err}`,
		);
	}
}

export async function getComputerVillageProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const r = await proxyRequest(`${url}?limit=200&page=${page}&fq=1`);
		if (r.status >= 400) break;
		const $ = cheerio.load(r.data);
		for (const el of $(".main-products.product-grid").children().toArray()) {
			try {
				const productUrl = $(el).find(".caption .name a").attr("href");
				if (!productUrl) continue;
				await addItemToQueue(productUrl, ProductProvider.COMPUTER_VILLAGE);
			} catch (err) {
				consoleError(
					ProductProvider.COMPUTER_VILLAGE,
					`Failed to add item to the queue : ${err}`,
				);
			}
		}
	}
}

export async function scrapeComputerVillageCategories() {
	try {
		const r = await proxyRequest("https://www.computervillage.com.bd/");
		const $ = cheerio.load(r.data);
		const navLinks = new Set<string>();
		for (const el of $(".main-menu .j-menu").children().toArray()) {
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
						ProductProvider.COMPUTER_VILLAGE,
					);
					if (isProcessed) return;
					consoleInfo(
						ProductProvider.COMPUTER_VILLAGE,
						`Scraping : ${navLink}`,
					);
					await getComputerVillageProductDetails(navLink);
				} catch (err) {
					consoleError(
						ProductProvider.COMPUTER_VILLAGE,
						`Failed to scrape : ${err}`,
					);
				}
			}),
		);
		await Promise.all(tasks);
		consoleSuccess(
			ProductProvider.COMPUTER_VILLAGE,
			`Processed all categories`,
		);
	} catch (err) {
		consoleError(ProductProvider.COMPUTER_VILLAGE, `Failed to scrape ${err}`);
	}
}
