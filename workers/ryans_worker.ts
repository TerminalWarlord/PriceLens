import { config } from "dotenv";
import { scrapeRyansCategories } from "../lib/scrapers/ryans";

config();

(async () => {
	await scrapeRyansCategories();
})();
