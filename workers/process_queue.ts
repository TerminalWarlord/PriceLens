import { redis_client } from "../lib/redis/redis_client";
import { processStartechProductUrl } from "../lib/scrapers/startech";
import { ProductProvider } from "../types/product_type";
import pLimit from "p-limit";
import { processAppleGadgetsProductUrl } from "../lib/scrapers/apple_gadgets";
import { processTechLandProductUrl } from "../lib/scrapers/techland";
import { processTechMarvelsProductUrl } from "../lib/scrapers/tech_marvels";
import { PRODUCT_PLIMIT } from "../lib/scrapers/scraper_config";
import { processItemWithTimeout } from "../lib/utils/process_helper";

async function processQueue() {
	const limit = pLimit(PRODUCT_PLIMIT);
	while (true) {
		const jobs: { provider: ProductProvider; productUrl: string }[] = [];
		const BATCH = parseInt(process.env.PRODUCT_PLIMIT!) || 5;
		for (let i = 0; i < BATCH; i++) {
			const job = await redis_client.rpop("pricelens");
			if (!job) break;
			jobs.push(
				JSON.parse(job) as { provider: ProductProvider; productUrl: string },
			);
		}
		if (jobs.length === 0) break;

		await Promise.all(
			jobs.map((item) =>
				limit(async () => {
					try {
						if (item.provider === ProductProvider.STARTECH) {
							await processItemWithTimeout(
								processStartechProductUrl(item.productUrl),
							);
						} else if (item.provider === ProductProvider.APPLE_GADGETS) {
							await processItemWithTimeout(
								processAppleGadgetsProductUrl(item.productUrl),
							);
						} else if (item.provider === ProductProvider.TECHLAND) {
							await processItemWithTimeout(
								processTechLandProductUrl(item.productUrl),
							);
						} else if (item.provider === ProductProvider.TECH_MARVELS) {
							await processItemWithTimeout(
								processTechMarvelsProductUrl(item.productUrl),
							);
						}
					} catch (err) {
						console.error(`Job failed : ${err}`);
					}
				}),
			),
		);
	}
}
await processQueue();
await redis_client.quit();
