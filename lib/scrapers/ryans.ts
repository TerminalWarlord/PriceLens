import * as cheerio from "cheerio";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import type { BrowserContext } from "playwright";
import { and, eq } from "drizzle-orm";
import { productsTable } from "../../src/db/schema/products";
import { ProductProvider } from "../../types/product_type";
import { db } from "../db";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { MAX_ITEM_LIMIT, MAX_PAGE_LIMIT } from "./scraper_config";
import { uploadImage } from "../r2/upload_image";

chromium.use(stealth());
const browser = await chromium.launch({
	headless: true,
	args: ["--headless=new"],
});

export async function getRyansProductDetails(
	url: string,
	browserContext: BrowserContext,
) {
	// https://www.ryans.com/category/laptop-all-laptop?limit=5000&sort=D&osp=1&st=0
	const page = await browserContext.newPage();
	for (let p = 1; p < MAX_PAGE_LIMIT; p++) {
		try {
			await page.goto(`${url}?limit=${MAX_ITEM_LIMIT}&page=${p}`, {
				waitUntil: "domcontentloaded",
			});

			// give CF time
			await page.waitForTimeout(6000);

			console.log(await page.title());
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

					if (
						!productName ||
						!productImage ||
						!productDescription ||
						!productUrl ||
						isNaN(productPrice)
					) {
						continue;
					}
					const item = await db
						.select()
						.from(productsTable)
						.where(
							and(
								eq(productsTable.product_url, productUrl),
								eq(productsTable.product_provider, ProductProvider.RYANS),
							),
						);
					if (item && item.length) {
						continue;
					}
					const uploadedImagePath = await uploadImage(
						productImage,
						ProductProvider.RYANS,
					);

					const [result] = await db
						.insert(productsTable)
						.values({
							product_name: productName,
							product_url: productUrl,
							product_price: productPrice,
							product_description: productDescription.trim(),
							product_image: uploadedImagePath,
							product_provider: ProductProvider.RYANS,
						})
						.returning({ id: productsTable.id });

					await db.insert(productPricesTable).values({
						name: productName,
						description: productDescription.trim(),
						price: productPrice,
						product_id: result.id,
						provider: ProductProvider.RYANS,
					});
				} catch (err) {
					console.error(err);
				}
			}
		} catch (err) {
			console.error(`Ryans: Failed at page ${p}: ${err}`);
		}
	}
	await page.close();
}

export async function scrapeRyansCategories() {
	const context = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		viewport: { width: 1280, height: 800 },
		locale: "en-BD",
	});

	const page = await context.newPage();

	await page.goto("https://www.ryans.com/", {
		waitUntil: "domcontentloaded",
	});

	// give CF time
	await page.waitForTimeout(6000);

	console.log(await page.title());
	const data = await page.content();
	const $ = cheerio.load(data);
	const allMenu = $("ul.list-unstyled");
	for (const el of allMenu.toArray()) {
		const navLink = $(el).children();
		for (const li of navLink.toArray()) {
			const item = $(li).find("a").attr("href");
			if (!item || item === "#") continue;
			try {
				console.info(`Scraping : ${item}`);
				await getRyansProductDetails(item, context);
			} catch (err) {
				console.error(`Failed to scrape ${item} : ${err}`);
			}
		}
	}
	await page.close();
	await browser.close();
}
