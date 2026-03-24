import { config } from "dotenv";
import { scrapeComputerVillageCategories } from "../lib/scrapers/computer_village";

config();

(async () => {
	await scrapeComputerVillageCategories();
})();
