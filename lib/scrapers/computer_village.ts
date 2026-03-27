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
import {
	isCategoryProcessed,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import pLimit from "p-limit";

export async function getComputerVillageProductDetails(url: string) {
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		const pageUrl = `${url}?limit=200&page=${page}&fq=1`;
		if (await isPageProcessed(pageUrl)) {
			consoleError(
				ProductProvider.COMPUTER_VILLAGE,
				`Already processed : ${pageUrl}`,
			);
			continue;
		}
		const r = await proxyRequest(pageUrl);
		if (r.status != 200) {
			consoleError(
				ProductProvider.COMPUTER_VILLAGE,
				`${r.status} Failed to get product!`,
			);
			continue;
		}
		const $ = cheerio.load(r.data);
		if ($(".main-products.product-grid").children().length === 0) {
			consoleError(
				ProductProvider.COMPUTER_VILLAGE,
				`No items found on ${pageUrl}`,
			);
			return;
		}
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
				if (
					!productName ||
					!productImage ||
					!productDescription ||
					!productUrl ||
					isNaN(productPrice) ||
					productPrice === 0
				) {
					continue;
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
					`Failed to store current item : ${err}`,
				);
			}
		}
		await markPageAsProcessed(pageUrl);
	}
}

export async function scrapeComputerVillageCategories() {
	try {
		const r = await proxyRequest("https://www.computervillage.com.bd/");
		const $ = cheerio.load(r.data);
		console.log(r.data);
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
