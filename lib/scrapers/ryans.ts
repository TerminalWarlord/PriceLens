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
		await page.goto(`${url}?limit=${MAX_ITEM_LIMIT}&page=${p}`, {
			waitUntil: "domcontentloaded",
		});

		// give CF time
		await page.waitForTimeout(6000);

		console.log(await page.title());
		const data = await page.content();
		const $ = cheerio.load(data);
		const allMenu = $("div.card.h-100");
		for (const el of allMenu.toArray()) {
			try {
				const product_url = $(el).find("div.image-box > a ").attr("href");
				const product_image = $(el)
					.find("div.image-box > a > img")
					.attr("src")
					?.replace("/small/", "/medium/");
				const product_name = $(el)
					.find("h4.product-name > a")
					.text()
					.split("...")[0]
					.trim();
				let product_description = "";
				for (const desc of $(el).find(".category-info").children().toArray()) {
					product_description += $(desc).text().trim() + "\n";
				}
				const product_price =
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
					!product_name ||
					!product_image ||
					!product_description ||
					!product_name ||
					!product_url ||
					isNaN(product_price)
				) {
					continue;
				}
				const item = await db
					.select()
					.from(productsTable)
					.where(
						and(
							eq(productsTable.product_url, product_url),
							eq(productsTable.product_provider, ProductProvider.RYANS),
						),
					);
				if (item && item.length) {
					continue;
				}
				const [result] = await db
					.insert(productsTable)
					.values({
						product_name,
						product_url,
						product_price,
						product_description,
						product_image,
						product_provider: ProductProvider.RYANS,
					})
					.returning({ id: productsTable.id });

				await db.insert(productPricesTable).values({
					name: product_name,
					description: product_description,
					price: product_price,
					product_id: result.id,
					provider: ProductProvider.RYANS,
				});
			} catch (err) {
				console.error(err);
			}
		}
		await page.close();
	}
}

export async function getRyansCategories() {
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
	// await browser.close();
	const data = await page.content();
	const $ = cheerio.load(data);
	const allMenu = $("ul.list-unstyled");
	for (const el of allMenu.toArray()) {
		const navLink = $(el).children();

		for (const li of navLink.toArray()) {
			const item = $(li).find("a").attr("href");
			if (!item || item === "#") continue;
			console.log(item);
			console.info(`Scraping : ${item}`);
			await getRyansProductDetails(item, context);
			// return
		}
	}
	await page.close();
	await browser.close();
}
