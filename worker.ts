import { config } from "dotenv";
import { scrapeStartechCategories } from "./lib/scrapers/startech";
import { scrapeRyansCategories } from "./lib/scrapers/ryans";
import { scrapeTechlandCategories } from "./lib/scrapers/techland";
import { scrapeComputerVillageCategories } from "./lib/scrapers/computer_village";
import { scrapeTechMarvelsCategories } from "./lib/scrapers/tech_marvels";
import { scrapeAppleGadgetsCategories } from "./lib/scrapers/apple_gadgets";

config();

(async () => {
	await Promise.all([
		scrapeStartechCategories(),
		scrapeRyansCategories(),
		scrapeTechlandCategories(),
		scrapeComputerVillageCategories(),
		scrapeTechMarvelsCategories(),
		scrapeAppleGadgetsCategories(),
	]);
})();
