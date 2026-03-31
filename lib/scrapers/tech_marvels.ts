import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { ProductProvider } from "../../types/product_type";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { consoleError, consoleInfo, consoleSuccess } from "./debugger";
import {
	addItemToQueue,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import { addProduct } from "./add_product";
import { getCategory } from "./add_category";
import { processCategories } from "./process_categories";

export async function processTechMarvelsProductDetails(
	productUrl: string,
	categoryId: number | undefined,
) {
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
			// TODO: remove item
			consoleError(ProductProvider.TECH_MARVELS, `Stock out ${productUrl}`);
			try {
				const [result] = await db
					.delete(productsTable)
					.where(
						and(
							eq(productsTable.product_url, productUrl),
							eq(productsTable.product_provider, ProductProvider.TECH_MARVELS),
						),
					)
					.returning({ id: productsTable.id });
				if (result) {
					consoleSuccess(
						ProductProvider.TECH_MARVELS,
						`Deleted ${result.id} : ${productUrl}`,
					);
				}
			} catch (err) {
				consoleError(ProductProvider.TECH_MARVELS, `Failed to remove : ${err}`);
			}
			return;
		}

		await addProduct({
			category_id: categoryId,
			product_description: productDescription.trim(),
			product_image: productImage,
			product_name: productName,
			product_price: productPrice,
			product_provider: ProductProvider.TECH_MARVELS,
			product_url: productUrl,
		});
	} catch (err) {
		consoleError(
			ProductProvider.TECH_MARVELS,
			`Failed to process ${productUrl}: ${err}`,
		);
	}
}

export async function getTechMarvelsCategoryProducts(url: string) {
	const categoryId = await getCategory(url, ProductProvider.TECH_MARVELS);
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
					await addItemToQueue(
						productUrl,
						ProductProvider.TECH_MARVELS,
						categoryId,
					);
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
		await processCategories(
			navLinks,
			ProductProvider.TECH_MARVELS,
			getTechMarvelsCategoryProducts,
		);
	} catch (err) {
		consoleError(ProductProvider.TECH_MARVELS, `Failed to scrape ${err}`);
	}
}
