import { and, eq, lt, sql } from "drizzle-orm";
import type { ProductProvider } from "../../types/product_type";
import { db } from "../db";
import { productsTable } from "../../src/db/schema/products";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { consoleSuccess } from "../scrapers/debugger";

export async function changeProductLastUpdated(
	productUrl: string,
	provider: ProductProvider,
) {
	// update product table
	const [res] = await db
		.update(productsTable)
		.set({
			updated_at: sql`now()`,
		})
		.where(
			and(
				eq(productsTable.product_url, productUrl),
				eq(productsTable.product_provider, provider),
				lt(productsTable.updated_at, sql`now() - INTERVAL '24 hours'`),
			),
		)
		.returning({
			id: productsTable.id,
			product_name: productsTable.product_name,
			product_price: productsTable.product_price,
			product_description: productsTable.product_description,
			product_provider: productsTable.product_provider,
		});

	if (res) {
		// add new record on product_prices
		await db.insert(productPricesTable).values({
			product_id: res.id,
			provider: res.product_provider,
			description: res.product_description,
			name: res.product_name,
			price: res.product_price,
		});
		consoleSuccess(provider, `Updated ${productUrl}`);
	}
}

// (async () =>
// 	await changeProductLastUpdated(
// 		"https://www.computervillage.com.bd/toshiba-e-studio-2323am-duplex-copier-9l",
// 		ProductProvider.COMPUTER_VILLAGE,
// 	))();
