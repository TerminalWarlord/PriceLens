import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { ProductProvider } from "../../types/product_type";
import { MAX_ITEM_LIMIT } from "./scraper_config";
import { consoleError, consoleInfo } from "./debugger";
import {
	addItemToQueue,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import { processCategories } from "./process_categories";
import { getCategory } from "../db_helpers/add_category";
import { addProduct } from "../db_helpers/add_product";
import { removeProduct } from "./availablity_checker/remove_product";
import { doesProductExist } from "../db_helpers/product_exists";

export async function processTechLandProductDetails(
	productUrl: string,
	categoryId?: number,
) {
	try {
		consoleInfo(ProductProvider.TECHLAND, `Scraping: ${productUrl}`);
		const r = await proxyRequest(productUrl);
		const $ = cheerio.load(r.data);
		if (r.status !== 200) {
			throw new Error("Failed to get product");
		}
		consoleInfo(
			ProductProvider.TECHLAND,
			`Getting product info: ${productUrl}`,
		);
		const productImage = $(".container").find("#main-image").attr("src");
		const productName = $(".container .order-1")
			.find(".break-words")
			.eq(0)
			.text()
			.trim();
		let productDescription = "";
		for (const el of $(".container .order-1")
			.find(".break-words")
			.eq(1)
			.children()
			.toArray()) {
			productDescription += $(el).text().trim() + "\n";
		}
		const isInStock =
			$(
				".inline-block.border.border-gray-300.rounded.px-2.sm\\:px-3.py-1.text-xs.sm\\:text-sm",
			)
				.eq(0)
				.find("span")
				.text()
				.trim() === "In Stock";
		if (!isInStock) {
			await removeProduct(productUrl, ProductProvider.TECHLAND);
			return;
		}
		const productPrice =
			Number(
				$(".container .order-1")
					.find(
						".text-lg.sm\\:text-xl.lg\\:text-2xl.font-bold.text-\\[\\#1c4289\\]",
					)
					.text()
					.trim()
					.replace(/৳/g, "")
					.replace(/,/g, ""),
			) * 100;

		await addProduct({
			category_id: categoryId,
			product_description: productDescription,
			product_image: productImage,
			product_name: productName,
			product_price: productPrice,
			product_provider: ProductProvider.TECHLAND,
			product_url: productUrl,
		});
	} catch (err) {
		consoleError(
			ProductProvider.TECHLAND,
			`Failed to scrape ${productUrl}: ${err}`,
		);
	}
}

export async function getTechlandCategoryProduct(url: string) {
	const categoryId = await getCategory(url, ProductProvider.TECHLAND);
	for (let page = 1; page < MAX_ITEM_LIMIT; page++) {
		try {
			const pageUrl = `${url}?page=${page}`;
			consoleInfo(ProductProvider.TECHLAND, `Browsing : ${pageUrl}`);
			if (await isPageProcessed(pageUrl)) {
				consoleError(
					ProductProvider.TECHLAND,
					`Already processed : ${pageUrl}`,
				);
				continue;
			}
			const r = await proxyRequest(pageUrl);
			const $ = cheerio.load(r.data);
			const productUrls: string[] = [];
			for (const el of $("#product-container").children().toArray()) {
				const productUrl = $(el).find("a").first().attr("href");
				const isAvailable =
					$(el)
						.find(".text-xs.text-green-700.font-medium")
						.text()
						.trim()
						.toLocaleLowerCase() === "in stock";
				if (!productUrl || !isAvailable) continue;
				productUrls.push(productUrl);
			}
			if (productUrls.length === 0) {
				consoleError(
					ProductProvider.TECHLAND,
					`No items found on ${url}?page=${page}`,
				);
				return;
			}
			for (const productUrl of productUrls) {
				if (await doesProductExist(productUrl, ProductProvider.TECHLAND)) {
					continue;
				}
				try {
					await addItemToQueue(
						productUrl,
						ProductProvider.TECHLAND,
						categoryId,
					);
				} catch (err) {
					consoleError(
						ProductProvider.TECHLAND,
						`Failed to add item to the queue ${productUrl} ${err}`,
					);
				}
			}
			await markPageAsProcessed(pageUrl);
		} catch (err) {
			consoleError(ProductProvider.TECHLAND, `Failed to scrape: ${err}`);
		}
	}
}

export async function scrapeTechlandCategories() {
	try {
		const r = await proxyRequest(
			"https://www.techlandbd.com/ajax/header-navigation",
		);
		const data = r.data;
		const $ = cheerio.load(data);
		const navLinks = new Set<string>();
		for (const el of $("a").toArray()) {
			const navLink = $(el).attr("href");
			if (!navLink || navLink === "#") continue;
			navLinks.add(navLink);
		}
		await processCategories(
			navLinks,
			ProductProvider.TECHLAND,
			getTechlandCategoryProduct,
		);
	} catch (err) {
		consoleError(ProductProvider.TECHLAND, `Failed to scrape ${err}`);
	}
}
