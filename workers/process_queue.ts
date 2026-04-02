import { redis_client } from "../lib/redis/redis_client";
import { processStartechProductDetails } from "../lib/scrapers/startech";
import { ProductProvider } from "../types/product_type";
import pLimit from "p-limit";
import { processAppleGadgetsProductDetails } from "../lib/scrapers/apple_gadgets";
import { processTechLandProductDetails } from "../lib/scrapers/techland";
import { processTechMarvelsProductDetails } from "../lib/scrapers/tech_marvels";
import { PRODUCT_PLIMIT } from "../lib/scrapers/scraper_config";
import { processItemWithTimeout } from "../lib/utils/process_helper";
import { processUCCProductDetails } from "../lib/scrapers/ucc";

async function processQueue() {
	const limit = pLimit(PRODUCT_PLIMIT);
	while (true) {
		const jobs: {
			provider: ProductProvider;
			productUrl: string;
			categoryId: number | undefined;
		}[] = [];
		const BATCH = parseInt(process.env.PRODUCT_PLIMIT!) || 5;
		for (let i = 0; i < BATCH; i++) {
			const job = await redis_client.rpop("pricelens");
			if (!job) break;
			jobs.push(
				JSON.parse(job) as {
					provider: ProductProvider;
					productUrl: string;
					categoryId: number | undefined;
				},
			);
		}
		if (jobs.length === 0) break;

		await Promise.all(
			jobs.map((item) =>
				limit(async () => {
					try {
						if (item.provider === ProductProvider.STARTECH) {
							await processItemWithTimeout(
								processStartechProductDetails(item.productUrl, item.categoryId),
							);
						} else if (item.provider === ProductProvider.APPLE_GADGETS) {
							await processItemWithTimeout(
								processAppleGadgetsProductDetails(
									item.productUrl,
									item.categoryId,
								),
							);
						} else if (item.provider === ProductProvider.TECHLAND) {
							await processItemWithTimeout(
								processTechLandProductDetails(item.productUrl, item.categoryId),
							);
						} else if (item.provider === ProductProvider.TECH_MARVELS) {
							await processItemWithTimeout(
								processTechMarvelsProductDetails(
									item.productUrl,
									item.categoryId,
								),
							);
						} else if (item.provider === ProductProvider.UCC) {
							await processItemWithTimeout(
								processUCCProductDetails(item.productUrl, item.categoryId),
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
