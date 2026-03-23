import * as cheerio from "cheerio";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());
const browser = await chromium.launch({
	headless: true,
	args: ["--headless=new"],
});

export async function getComputerVillageCategories() {
	const context = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		viewport: { width: 1280, height: 800 },
		locale: "en-BD",
	});

	const page = await context.newPage();

	await page.goto("https://www.computervillage.com.bd/", {
		waitUntil: "domcontentloaded",
	});

	await page.waitForTimeout(10000);
	console.log(await page.title());

	const $ = cheerio.load(await page.content());
	for (const el of $("#main-menu").children().toArray()) {
		console.log($(el).find("a").attr("href"));
	}
}
