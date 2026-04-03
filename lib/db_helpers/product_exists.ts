import { and, eq } from "drizzle-orm";
import { productsTable } from "../../src/db/schema/products";
import type { ProductProvider } from "../../types/product_type";
import { db } from "../db";

export async function doesProductExist(
	productUrl: string,
	provider: ProductProvider,
) {
	const [item] = await db
		.select()
		.from(productsTable)
		.where(
			and(
				eq(productsTable.product_url, productUrl),
				eq(productsTable.product_provider, provider),
			),
		)
		.limit(1);
	if (item) {
		return true;
	}
	return false;
}
