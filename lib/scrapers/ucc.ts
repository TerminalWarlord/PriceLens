import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { consoleError, consoleInfo } from "./debugger";
import { ProductProvider } from "../../types/product_type";
import {
	addItemToQueue,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";
import { addProduct } from "../db_helpers/add_product";
import { getCategory } from "../db_helpers/add_category";
import { processCategories } from "./process_categories";
import { removeProduct } from "./availablity_checker/remove_product";

const BASE_URL = "https://www.ucc.com.bd";

export async function processUCCProductDetails(
	productUrl: string,
	categoryId?: number,
) {
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
		const priceSection = $("li.product-stock").text().trim().toLowerCase();
		const isAvailable = priceSection.includes("in stock");
		if (!isAvailable) {
			await removeProduct(productUrl, ProductProvider.UCC);
			return;
		}
		await addProduct({
			category_id: categoryId,
			product_description: productDescription,
			product_image: productImage,
			product_name: productName,
			product_price: productPrice,
			product_provider: ProductProvider.UCC,
			product_url: productUrl,
		});
	} catch (err) {
		console.log(err);
	}
}

async function getUCCCategoryCategoryProducts(url: string) {
	const categoryId = await getCategory(url, ProductProvider.UCC);
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
				break;
			}

			let processed = 0;
			for (const productUrl of productUrls) {
				try {
					await addItemToQueue(productUrl, ProductProvider.UCC, categoryId);
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
		await processCategories(
			navLinks,
			ProductProvider.UCC,
			getUCCCategoryCategoryProducts,
		);
	} catch (err) {
		console.log(err);
	}
}
