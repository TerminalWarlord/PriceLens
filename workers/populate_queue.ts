import { scrapeAppleGadgetsCategories } from "../lib/scrapers/apple_gadgets";
import { scrapeComputerVillageCategories } from "../lib/scrapers/computer_village";
import { scrapeStartechCategories } from "../lib/scrapers/startech";
import { scrapeTechMarvelsCategories } from "../lib/scrapers/tech_marvels";
import { scrapeTechlandCategories } from "../lib/scrapers/techland";
import { scrapeUCCCategories } from "../lib/scrapers/ucc";
import { redis_client } from "../lib/redis/redis_client";

async function populateQueue() {
	await scrapeUCCCategories();
	await scrapeStartechCategories();
	await scrapeTechlandCategories();
	await scrapeComputerVillageCategories();
	await scrapeAppleGadgetsCategories();
	await scrapeTechMarvelsCategories();
}

await populateQueue();
await redis_client.quit();
