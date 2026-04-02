import * as cheerio from "cheerio";
import { ProductProvider } from "../../types/product_type";
import { CF_PROXY, MAX_ITEM_LIMIT, MAX_PAGE_LIMIT } from "./scraper_config";
import { consoleError } from "./debugger";
import { addProduct } from "./add_product";
import { processCategories } from "./process_categories";
import { addCategory } from "./add_category";
import { isPageProcessed, markPageAsProcessed } from "../redis/redis_helper";
import { proxyRequest } from "../utils/proxy_request";
import { getCategoryFromProvider } from "./category_selectors";

async function getRyansCategory(url: string) {
	try {
		const r = await proxyRequest(CF_PROXY + url);
		const $ = cheerio.load(r.data.result);
		const categoryName = getCategoryFromProvider(ProductProvider.RYANS, $);
		if (categoryName) {
			return await addCategory(url, categoryName, ProductProvider.RYANS);
		}
	} catch (err) {
		consoleError(
			ProductProvider.RYANS,
			`Failed to extract category ${url} : ${err}`,
		);
	}
}

export async function getRyansProductDetails(url: string) {
	// https://www.ryans.com/category/laptop-all-laptop?limit=5000&sort=D&osp=1&st=0
	const categoryId = await getRyansCategory(url);
	for (let p = 1; p < MAX_PAGE_LIMIT; p++) {
		const pageUrl = `${url}?limit=${MAX_ITEM_LIMIT}&page=${p}&osp=1`;
		try {
			if (await isPageProcessed(pageUrl)) {
				consoleError(
					ProductProvider.RYANS,
					`${pageUrl} has already been processed`,
				);
				continue;
			}
			const r = await proxyRequest(CF_PROXY + pageUrl);
			const $ = cheerio.load(r.data.result);
			const allMenu = $("div.card.h-100");
			if (!allMenu.length) break;
			for (const el of allMenu.toArray()) {
				try {
					const productUrl = $(el).find("div.image-box > a ").attr("href");
					const productImage = $(el)
						.find("div.image-box > a > img")
						.attr("src")
						?.replace("/small/", "/medium/");
					const productName = $(el)
						.find("h4.product-name > a")
						.text()
						.split("...")[0]
						.trim();
					let productDescription = "";
					for (const desc of $(el)
						.find(".category-info")
						.children()
						.toArray()) {
						productDescription += $(desc).text().trim() + "\n";
					}
					const productPrice =
						Number(
							$(el)
								.find(".pr-text.cat-sp-text")
								.text()
								.trim()
								.replace("Tk", "")
								.replace(/,/g, "")
								.trim(),
						) * 100;

					await addProduct({
						category_id: categoryId,
						product_description: productDescription.trim(),
						product_image: productImage,
						product_name: productName,
						product_price: productPrice,
						product_provider: ProductProvider.RYANS,
						product_url: productUrl,
					});
				} catch (err) {
					consoleError(ProductProvider.RYANS, `Failed to scrape : ${err}`);
				}
			}
		} catch (err) {
			consoleError(ProductProvider.RYANS, `Failed at page ${p}: ${err}`);
			break;
		}
		await markPageAsProcessed(pageUrl);
	}
}

export async function scrapeRyansCategories() {
	try {
		const r = await proxyRequest(CF_PROXY + "https://www.ryans.com/");
		const data = r.data;
		const $ = cheerio.load(data.result);
		const allMenu = $("ul.list-unstyled");
		const navLinks = new Set<string>();
		for (const el of allMenu.toArray()) {
			const navLink = $(el).children();
			for (const li of navLink.toArray()) {
				const item = $(li).find("a").attr("href");
				if (!item || item === "#") continue;
				navLinks.add(item);
				break;
			}
		}
		await processCategories(
			navLinks,
			ProductProvider.RYANS,
			getRyansProductDetails,
			1,
		);
	} catch (err) {
		consoleError(ProductProvider.RYANS, `Failed to scrape ${err}`);
	}
}

// (async () => {
// 	await getRyansProductDetails("https://www.ryans.com/category/laptop-all-laptop");
// 	// await scrapeRyansCategories();
// })()
