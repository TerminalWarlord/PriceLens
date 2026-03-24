import { config } from "dotenv";
import { scrapeTechMarvelsCategories } from "../lib/scrapers/tech_marvels";

config();

(async () => {
	await scrapeTechMarvelsCategories();
})();
