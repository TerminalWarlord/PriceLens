import { and, eq } from "drizzle-orm";
import { productsTable } from "../../../src/db/schema/products";
import { ProductProvider } from "../../../types/product_type";
import { db } from "../../db";
import { consoleError } from "../debugger";

export async function removeProduct(
	productUrl: string,
	provider: ProductProvider,
) {
	consoleError(provider, `Stock out ${productUrl}`);
	const [result] = await db
		.delete(productsTable)
		.where(
			and(
				eq(productsTable.product_url, productUrl),
				eq(productsTable.product_provider, provider),
			),
		)
		.returning({ id: productsTable.id });
	if (result) {
		consoleError(
			provider,
			`[Not available in stock] ${result.id} (${productUrl}) was deleted!`,
		);
	}
}
