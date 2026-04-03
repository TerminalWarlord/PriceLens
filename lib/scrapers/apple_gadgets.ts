import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../utils/proxy_request";
import { ProductProvider } from "../../types/product_type";
import { consoleError, consoleInfo } from "./debugger";
import { addProduct } from "../db_helpers/add_product";
import { processCategories } from "./process_categories";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import {
	addItemToQueue,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import { getCategory } from "../db_helpers/add_category";
import { removeProduct } from "./availablity_checker/remove_product";
import { doesProductExist } from "../db_helpers/product_exists";

const BASE_URL = "https://www.applegadgetsbd.com";

export async function processAppleGadgetsProductDetails(
	productUrl: string,
	categoryId?: number,
) {
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
		const stockMatch = data.match(
			/\\"variants\\"[\s\S]*?\\"status\\"\s*:\s*\\"([^\\"]+)\\"/,
		);
		const isAvailable =
			stockMatch?.[1].trim().includes("in-stock") ||
			stockMatch?.[1].trim().includes("online-order");
		if (!isAvailable) {
			await removeProduct(productUrl, ProductProvider.APPLE_GADGETS);
			return;
		}

		await addProduct({
			category_id: categoryId,
			product_description: productDescription.trim(),
			product_image: productImage,
			product_name: productName,
			product_price: productPrice,
			product_provider: ProductProvider.APPLE_GADGETS,
			product_url: productUrl,
		});
	} catch (err) {
		consoleError(
			ProductProvider.APPLE_GADGETS,
			`Failed to add ${productUrl} : ${err}`,
		);
	}
}

export async function getAppleGadgetsCategoryProducts(url: string) {
	const categoryId = await getCategory(url, ProductProvider.APPLE_GADGETS);
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
		for (const productUrl of productUrls) {
			if (await doesProductExist(productUrl, ProductProvider.APPLE_GADGETS)) {
				continue;
			}
			try {
				await addItemToQueue(
					productUrl,
					ProductProvider.APPLE_GADGETS,
					categoryId,
				);
			} catch (err) {
				consoleError(
					ProductProvider.APPLE_GADGETS,
					`Failed to add item to the queue ${productUrl}: ${err}`,
				);
			}
		}
		await markPageAsProcessed(pageUrl);
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
		await processCategories(
			navLinks,
			ProductProvider.APPLE_GADGETS,
			getAppleGadgetsCategoryProducts,
		);
	} catch (err) {
		consoleError(ProductProvider.APPLE_GADGETS, `Failed to scrape ${err}`);
	}
}
