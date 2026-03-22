import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { ProductProvider } from "../../types/product_type";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { MAX_ITEM_LIMIT } from "./scraper_config";

export async function processProductUrl(product_url: string) {
	const r = await proxyRequest(product_url);
	const $ = cheerio.load(await r.data);
	const product_image = $(".container").find("#main-image").attr("src");
	const product_name = $(".container .order-1")
		.find(".break-words")
		.eq(0)
		.text()
		.trim();
	let product_description = "";
	for (const el of $(".container .order-1")
		.find(".break-words")
		.eq(1)
		.children()
		.toArray()) {
		product_description += $(el).text().trim() + "\n";
	}
	const product_price =
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
	console.log(product_name, product_price);

	if (
		!product_name ||
		!product_image ||
		!product_description ||
		!product_name ||
		!product_url ||
		isNaN(product_price)
	) {
		return;
	}
	const item = await db
		.select()
		.from(productsTable)
		.where(
			and(
				eq(productsTable.product_url, product_url),
				eq(productsTable.product_provider, ProductProvider.TECHLAND),
			),
		);
	if (item && item.length) {
		return;
	}
	console.info(`Adding ${product_url}...`);
	const [result] = await db
		.insert(productsTable)
		.values({
			product_name,
			product_url,
			product_price,
			product_description,
			product_image,
			product_provider: ProductProvider.TECHLAND,
		})
		.returning({ id: productsTable.id });

	await db.insert(productPricesTable).values({
		name: product_name,
		description: product_description,
		price: product_price,
		product_id: result.id,
		provider: ProductProvider.TECHLAND,
	});
}

export async function getTechlandProductDetails(url: string) {
	// https://www.techlandbd.com/shop-laptop-computer/brand-laptops
	for (let page = 1; page < MAX_ITEM_LIMIT; page++) {
		try {
			console.info(`PAGE ${page}...`);
			const r = await proxyRequest(url);
			const $ = cheerio.load(await r.data);
			const productUrls: string[] = [];
			for (const el of $("#product-container").children().toArray()) {
				const productUrl = $(el).find("a").first().attr("href");
				if (!productUrl) continue;
				productUrls.push(productUrl);
			}
			for (const productUrl of productUrls) {
				try {
					await processProductUrl(productUrl);
				} catch (err) {
					console.error(`Failed to process ${productUrl} ${err}`);
				}
			}
		} catch (err) {
			console.error(err);
		}
	}
}

export async function scrapeTechlandCategories() {
	const r = await proxyRequest(
		"https://www.techlandbd.com/ajax/header-navigation",
	);
	const data = await r.data;
	const $ = cheerio.load(data);
	for (const el of $("a").toArray()) {
		const navLink = $(el).attr("href");
		if (!navLink || navLink === "#") continue;
		console.info(`Scraping ${navLink}...`);
		await getTechlandProductDetails(navLink);
	}
}
