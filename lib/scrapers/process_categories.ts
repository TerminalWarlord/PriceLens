import pLimit from "p-limit";
import { PLIMIT } from "./scraper_config";
import type { ProductProvider } from "../../types/product_type";
import { processItemWithTimeout } from "../utils/process_helper";
import { consoleError, consoleSuccess } from "./debugger";
import { isCategoryProcessed } from "../redis/redis_helper";

export async function processCategories(
	navLinks: Set<string>,
	provider: ProductProvider,
	cb: (url: string) => Promise<void>,
) {
	const categoryLimit = pLimit(PLIMIT);
	const tasks = Array.from(navLinks).map((navLink) =>
		categoryLimit(async () => {
			try {
				if (await isCategoryProcessed(navLink, provider)) {
					consoleError(provider, `${navLink} has already been processed`);
					return;
				}
				await processItemWithTimeout(cb(navLink));
			} catch (err) {
				consoleError(provider, `Failed to scrape ${navLink} :${err}`);
			}
		}),
	);

	await Promise.all(tasks);
	consoleSuccess(provider, `Processed all categories`);
}
