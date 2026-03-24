import { config } from "dotenv";
import { scrapeAppleGadgetsCategories } from "../lib/scrapers/apple_gadgets";

config();

(async () => {
	await scrapeAppleGadgetsCategories();
})();
