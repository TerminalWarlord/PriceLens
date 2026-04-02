import { sql } from "drizzle-orm";
import { db } from "../src";
import { ProductProvider } from "../types/product_type";
import { isItemAvailableOnRyans } from "../lib/scrapers/availablity_checker/ryans.stock";
import { isItemAvailableOnAppleGadgets } from "../lib/scrapers/availablity_checker/apple_gadgets.stock";
import { isItemAvailableOnDazzle } from "../lib/scrapers/availablity_checker/dazzle.stock";
import { isItemAvailableOnUCC } from "../lib/scrapers/availablity_checker/ucc.stock";
import { isItemAvailableOnSkyLand } from "../lib/scrapers/availablity_checker/skyland.stock";
import { isItemAvailableOnTechLand } from "../lib/scrapers/availablity_checker/techland.stock";
import { isItemAvailableOnTechMarvels } from "../lib/scrapers/availablity_checker/tech_marvels.stock";
import { isItemAvailableOnStarTech } from "../lib/scrapers/availablity_checker/startech.stock";
import { PLIMIT, PRODUCT_PLIMIT } from "../lib/scrapers/scraper_config";
import pLimit from "p-limit";
import { processItemWithTimeout } from "../lib/utils/process_helper";
import { addItemToQueue } from "../lib/redis/redis_helper";
import { consoleError } from "../lib/scrapers/debugger";

// Probably not efficient, but for the time being get
// the products there werent updated in past 48hrs and check their availablity

const PROVIDER_MAP = {
	[ProductProvider.APPLE_GADGETS]: isItemAvailableOnAppleGadgets,
	[ProductProvider.DAZZLE]: isItemAvailableOnDazzle,
	[ProductProvider.RYANS]: isItemAvailableOnRyans,
	[ProductProvider.SKYLANDBD]: isItemAvailableOnSkyLand,
	[ProductProvider.STARTECH]: isItemAvailableOnStarTech,
	[ProductProvider.TECHLAND]: isItemAvailableOnTechLand,
	[ProductProvider.TECH_MARVELS]: isItemAvailableOnTechMarvels,
	[ProductProvider.UCC]: isItemAvailableOnUCC,
	[ProductProvider.VERTECH]: async () => {},
	[ProductProvider.COMPUTER_VILLAGE]: async () => {},
	[ProductProvider.ULTRATECH]: async () => {},
	[ProductProvider.POTAKAIT]: async () => {},
	[ProductProvider.VIBEGAMING]: async () => {},
} as const;

async function addCleanUpItemsToQueue() {
	const BATCH = 1000;
	let OFFSET = 0;
	while (true) {
		const products = await db.execute(sql`
        SELECT id, product_url, updated_at, product_provider
        FROM products
        WHERE updated_at < now() - interval '48 hours'
        OFFSET ${OFFSET}
        LIMIT ${BATCH};
    `);
		if (!products || products.rowCount === 0) break;
		const results = products?.rows;
		if (results && results?.length > 0) {
			for (const product of results) {
				const provider = product.product_provider as ProductProvider;
				const productUrl = product.product_url as string;
				const updatedAt = product.updated_at;
				await addItemToQueue(
					productUrl,
					provider,
					undefined,
					`pricelens:cleanup`,
				);
			}
		}
		OFFSET += BATCH;
	}
}

async function cleanUpUnavailableProductsFromQueue() {
	const limit = pLimit(PLIMIT);
	const key = `pricelens:cleanup`;
	while (true) {
		const jobs: {
			productUrl: string;
			provider: ProductProvider;
			updatedAt: string;
		}[] = [];
		const BATCH = PRODUCT_PLIMIT;
		for (let i = 0; i < BATCH; i++) {
			const job = await redis_client?.rpop(key);
			if (!job) break;
			jobs.push(
				JSON.parse(job) as {
					productUrl: string;
					provider: ProductProvider;
					updatedAt: string;
				},
			);
		}
		if (jobs.length === 0) break;

		await Promise.all(
			jobs.map((item) =>
				limit(async () => {
					const provider = item.provider as ProductProvider;
					const productUrl = item.productUrl as string;
					console.log(item);
					try {
						await processItemWithTimeout(PROVIDER_MAP[provider](productUrl));
					} catch (err) {
						consoleError(provider, `Failed to update ${productUrl}`);
					}
				}),
			),
		);
		console.log("Complete");
	}
	await redis_client?.quit();
}

(async () => {
	await addCleanUpItemsToQueue();
	await cleanUpUnavailableProductsFromQueue();
})();
