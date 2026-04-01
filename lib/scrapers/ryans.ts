import * as cheerio from "cheerio";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { ProductProvider } from "../../types/product_type";
import { MAX_ITEM_LIMIT, MAX_PAGE_LIMIT } from "./scraper_config";
import { consoleError, consoleInfo } from "./debugger";

import { addProduct } from "./add_product";
import { processCategories } from "./process_categories";
import { addCategory } from "./add_category";
import { isPageProcessed, markPageAsProcessed } from "../redis/redis_helper";

chromium.use(stealth());
const browser = await chromium.launch({
	headless: true,
	args: ["--headless=new"],
});

const context = await browser.newContext({
	userAgent:
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	viewport: { width: 1280, height: 800 },
	locale: "en-BD",
});

async function getRyansCategory(url: string) {
	try {
		const page = await context.newPage();
		await page.goto(url);
		await page.waitForTimeout(6000);
		const $ = cheerio.load(await page.content());
		const categoryName = $("div.card div.card-body span")
			.eq(2)
			.find("a")
			.text()
			.trim();
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
	const page = await context.newPage();
	await page.goto(url);
	await page.waitForTimeout(6000);
	// console.log(await page.title());
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
			await page.goto(pageUrl, {
				waitUntil: "domcontentloaded",
			});

			// give CF time
			await page.waitForTimeout(6000);

			consoleInfo(ProductProvider.RYANS, await page.title());
			const data = await page.content();
			const $ = cheerio.load(data);
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
	await page.close();
}

export async function scrapeRyansCategories() {
	const page = await context.newPage();
	await page.goto("https://www.ryans.com/", {
		waitUntil: "domcontentloaded",
	});

	// give CF time
	await page.waitForTimeout(6000);

	consoleInfo(ProductProvider.RYANS, await page.title());
	const data = await page.content();
	const $ = cheerio.load(data);
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

	await page.close();
	await browser.close();
}
