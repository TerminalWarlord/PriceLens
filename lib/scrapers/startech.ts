import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../utils/proxy_request";
import { ProductProvider } from "../../types/product_type";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { consoleError, consoleInfo } from "./debugger";
import {
	addItemToQueue,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import { processCategories } from "./process_categories";
import { addProduct } from "../db_helpers/add_product";
import { getCategory } from "../db_helpers/add_category";
import { removeProduct } from "./availablity_checker/remove_product";
import { doesProductExist } from "../db_helpers/product_exists";

export async function processStartechProductDetails(
	productUrl: string,
	categoryId?: number,
) {
	try {
		const r = await proxyRequest(productUrl);
		const data = r.data;
		if (r.status !== 200) {
			throw new Error("Failed to get product");
		}
		const $ = cheerio.load(data);
		const productName = $("h1.product-name").text().trim();
		const productPrice =
			Number(
				$("table.product-info-table tbody")
					.find(".product-info-data.product-price")
					.text()
					.trim()
					.split("৳")[0]
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
		const stock = $(
			"table.product-info-table td.product-info-data.product-status",
		)
			.text()
			.trim()
			.toLowerCase();
		const isAvailable = stock.includes("in stock");
		if (!isAvailable) {
			await removeProduct(productUrl, ProductProvider.STARTECH);
			return;
		}
		await addProduct({
			category_id: categoryId,
			product_description: productDescription.trim(),
			product_image: productImage,
			product_name: productName,
			product_price: productPrice,
			product_provider: ProductProvider.STARTECH,
			product_url: productUrl,
		});
	} catch (err) {
		consoleError(
			ProductProvider.STARTECH,
			`Failed to scrape ${productUrl}: ${err}`,
		);
	}
}

export async function getStartechCategoryProducts(url: string) {
	const categoryId = await getCategory(url, ProductProvider.STARTECH);
	for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
		consoleInfo(
			ProductProvider.STARTECH,
			`Scraping page ${page}/${MAX_PAGE_LIMIT}...`,
		);
		// filter_status=7 -> only shows in stock items
		const pageUrl = url + `?page=${page}&filter_status=7`;
		if (await isPageProcessed(pageUrl)) {
			consoleError(ProductProvider.STARTECH, `Already processed : ${pageUrl}`);
			continue;
		}
		const r = await proxyRequest(pageUrl);
		const data = r.data;
		const $ = cheerio.load(data);
		const items = $(".container").find(".p-item");

		const productUrls: string[] = [];
		for (const el of items.children().toArray()) {
			const productUrl = $(el).find(".p-item-name").find("a").attr("href");
			if (!productUrl) continue;
			productUrls.push(productUrl);
		}
		if (productUrls.length === 0) {
			consoleError(
				ProductProvider.STARTECH,
				`No more items found on page ${pageUrl}`,
			);
			return;
		}

		for (const productUrl of productUrls) {
			if (await doesProductExist(productUrl, ProductProvider.STARTECH)) {
				continue;
			}
			try {
				await addItemToQueue(productUrl, ProductProvider.STARTECH, categoryId);
			} catch (err) {
				consoleError(
					ProductProvider.STARTECH,
					`Failed to add ${productUrl} : ${err}`,
				);
			}
		}
		await markPageAsProcessed(pageUrl);
	}
}

export async function scrapeStartechCategories() {
	try {
		const url = "https://www.startech.com.bd/";
		const r = await proxyRequest(url, Method.GET);
		const data = r.data;
		const $ = cheerio.load(data);
		const navLinks = new Set<string>();
		for (const el of $("a.nav-link").toArray()) {
			const navLink = $(el).attr("href");
			if (!navLink) continue;
			navLinks.add(navLink);
		}
		await processCategories(
			navLinks,
			ProductProvider.STARTECH,
			getStartechCategoryProducts,
		);
	} catch (err) {
		consoleError(ProductProvider.STARTECH, `Failed to scrape ${err}`);
	}
}
