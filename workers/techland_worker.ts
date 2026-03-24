import { config } from "dotenv";
import { scrapeTechlandCategories } from "../lib/scrapers/techland";

config();

(async () => {
	await scrapeTechlandCategories();
})();
