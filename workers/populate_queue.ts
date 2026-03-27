import { scrapeAppleGadgetsCategories } from "../lib/scrapers/apple_gadgets";
import { scrapeComputerVillageCategories } from "../lib/scrapers/computer_village";
import { scrapeStartechCategories } from "../lib/scrapers/startech";
import { scrapeTechMarvelsCategories } from "../lib/scrapers/tech_marvels";
import { scrapeTechlandCategories } from "../lib/scrapers/techland";

async function populateQueue() {
	await scrapeStartechCategories();
	await scrapeTechlandCategories();
	await scrapeComputerVillageCategories();
	await scrapeAppleGadgetsCategories();
	await scrapeTechMarvelsCategories();
}

await populateQueue();
await redis_client?.quit();
