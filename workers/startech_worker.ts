import { config } from "dotenv";
import { scrapeStartechCategories } from "../lib/scrapers/startech";

config();

(async () => {
	await scrapeStartechCategories();
})();
