import { scrapeComputerVillageCategories } from "../lib/scrapers/computer_village";
import { scrapeDazzleCategories } from "../lib/scrapers/dazzle";
import { scrapeRyansCategories } from "../lib/scrapers/ryans";
import { redis_client } from "../lib/redis/redis_client";

await scrapeDazzleCategories();
await scrapeComputerVillageCategories();
await scrapeRyansCategories();
await redis_client.quit();
