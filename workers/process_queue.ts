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

const PROVIDER_MAP = {
	[ProductProvider.APPLE_GADGETS]: processAppleGadgetsProductDetails,
	[ProductProvider.DAZZLE]: async () => {},
	[ProductProvider.RYANS]: async () => {},
	[ProductProvider.SKYLANDBD]: async () => {},
	[ProductProvider.STARTECH]: processStartechProductDetails,
	[ProductProvider.TECHLAND]: processTechLandProductDetails,
	[ProductProvider.TECH_MARVELS]: processTechMarvelsProductDetails,
	[ProductProvider.UCC]: processUCCProductDetails,
	[ProductProvider.VERTECH]: async () => {},
	[ProductProvider.COMPUTER_VILLAGE]: async () => {},
	[ProductProvider.ULTRATECH]: async () => {},
	[ProductProvider.POTAKAIT]: async () => {},
	[ProductProvider.VIBEGAMING]: async () => {},
} as const;

export async function processQueue() {
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
						const fn = PROVIDER_MAP[item.provider];
						await processItemWithTimeout(() =>
							fn(item.productUrl, item.categoryId),
						);
					} catch (err) {
						console.error(`Job failed : ${err}`);
					}
				}),
			),
		);
	}
}
