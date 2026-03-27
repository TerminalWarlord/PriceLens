import { scrapeComputerVillageCategories } from "../lib/scrapers/computer_village";
import { redis_client } from "../lib/redis/redis_client";

await scrapeComputerVillageCategories();

await redis_client.quit();
