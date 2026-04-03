import { scrapeAppleGadgetsCategories } from "../lib/scrapers/apple_gadgets";
import { scrapeComputerVillageCategories } from "../lib/scrapers/computer_village";
import { scrapeStartechCategories } from "../lib/scrapers/startech";
import { scrapeTechMarvelsCategories } from "../lib/scrapers/tech_marvels";
import { scrapeTechlandCategories } from "../lib/scrapers/techland";
import { scrapeUCCCategories } from "../lib/scrapers/ucc";
import { redis_client } from "../lib/redis/redis_client";
import { flushQueueAndSet, setTtlOnQueue } from "../lib/redis/redis_helper";

async function populateQueue() {
	await flushQueueAndSet();
	await scrapeStartechCategories();
	await scrapeTechlandCategories();
	await scrapeComputerVillageCategories();
	await scrapeUCCCategories();
	await scrapeAppleGadgetsCategories();
	await scrapeTechMarvelsCategories();
	await setTtlOnQueue(60 * 60 * 6); // lets try 6 hrs for now
}

await populateQueue();
await redis_client.quit();
