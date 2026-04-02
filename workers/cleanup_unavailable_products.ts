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

// Probably not efficient, but for the time being get
// the products there werent updated in past 48hrs and check their availablity
async function cleanUpUnavailableProducts() {
	const BATCH = 100;
	while (true) {
		const products = await db.execute(sql`
        SELECT id, product_url, updated_at, product_provider
        FROM products
        WHERE updated_at < now() - interval '48 hours'
        ORDER BY updated_at
        LIMIT ${BATCH};
    `);
		if (!products || products.rowCount === 0) break;
		const results = products?.rows;
		if (results && results?.length > 0) {
			for (const product of results) {
				const provider = product.product_provider as ProductProvider;
				const productUrl = product.product_url as string;
				console.log(product);
				if (provider === ProductProvider.RYANS) {
					await isItemAvailableOnRyans(productUrl);
				} else if (provider === ProductProvider.STARTECH) {
					await isItemAvailableOnStarTech(productUrl);
				} else if (provider === ProductProvider.APPLE_GADGETS) {
					await isItemAvailableOnAppleGadgets(productUrl);
				} else if (provider === ProductProvider.DAZZLE) {
					await isItemAvailableOnDazzle(productUrl);
				} else if (provider === ProductProvider.UCC) {
					await isItemAvailableOnUCC(productUrl);
				} else if (provider === ProductProvider.SKYLANDBD) {
					await isItemAvailableOnSkyLand(productUrl);
				} else if (provider === ProductProvider.TECHLAND) {
					await isItemAvailableOnTechLand(productUrl);
				} else if (provider === ProductProvider.TECH_MARVELS) {
					await isItemAvailableOnTechMarvels(productUrl);
				}
				// Needs some work
				// else if (provider === ProductProvider.COMPUTER_VILLAGE) {
				// }
			}
		}
	}
	await redis_client?.quit();
}

(async () => await cleanUpUnavailableProducts())();
