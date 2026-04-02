import { and, eq } from "drizzle-orm";
import { productsTable } from "../../../src/db/schema/products";
import type { ProductProvider } from "../../../types/product_type";
import { db } from "../../db";
import { consoleSuccess } from "../debugger";

export async function changeProductLastUpdated(
	productUrl: string,
	provider: ProductProvider,
) {
	const [res] = await db
		.update(productsTable)
		.set({
			updated_at: new Date(),
		})
		.where(
			and(
				eq(productsTable.product_url, productUrl),
				eq(productsTable.product_provider, provider),
			),
		)
		.returning({ id: productsTable.id });
	if (res) {
		consoleSuccess(provider, `Updated ${productUrl}`);
	}
}
