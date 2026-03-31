import { proxyRequest } from "../utils/proxy_request";
import * as cheerio from "cheerio";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { ProductProvider } from "../../types/product_type";
import { consoleError } from "./debugger";
import { isPageProcessed, markPageAsProcessed } from "../redis/redis_helper";
import { processCategories } from "./process_categories";
import { addProduct } from "./add_product";
import { getCategory } from "./add_category";

export async function getComputerVillageCategoryProducts(url: string) {
	const categoryId = await getCategory(url, ProductProvider.COMPUTER_VILLAGE);
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
				await addProduct({
					category_id: categoryId,
					product_description: productDescription.trim(),
					product_image: productImage,
					product_name: productName,
					product_price: productPrice,
					product_provider: ProductProvider.COMPUTER_VILLAGE,
					product_url: productUrl,
				});
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
		const navLinks = new Set<string>();
		for (const el of $(".main-menu .j-menu").children().toArray()) {
			const navLink = $(el).find("a").attr("href");
			if (!navLink) continue;
			navLinks.add(navLink);
		}
		await processCategories(
			navLinks,
			ProductProvider.COMPUTER_VILLAGE,
			getComputerVillageCategoryProducts,
		);
	} catch (err) {
		consoleError(ProductProvider.COMPUTER_VILLAGE, `Failed to scrape ${err}`);
	}
}
