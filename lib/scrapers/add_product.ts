import { productsTable } from "../../src/db/schema/products";
import type { Product, ProductProvider } from "../../types/product_type";
import { uploadImage } from "../r2/upload_image";
import { db } from "../../src";
import { and, eq } from "drizzle-orm";
import { productPricesTable } from "../../src/db/schema/product_prices";
import { consoleError, consoleInfo, consoleSuccess } from "./debugger";
import { UPDATE_FREQUENCY } from "./scraper_config";
import { productCategoriesTable } from "../../src/db/schema/product_categories";

type CustomProduct = {
	category_id: number | undefined;
	product_description: string | undefined;
	product_image: string | undefined;
	product_name: string | undefined;
	product_price: number;
	product_provider: ProductProvider;
	product_url: string | undefined;
};

async function addRecordToProductPricesTable({
	name,
	description,
	price,
	product_id,
	provider,
}: {
	name: string;
	description: string;
	price: bigint;
	product_id: number;
	provider: ProductProvider;
}) {
	await db.insert(productPricesTable).values({
		name,
		description,
		price,
		product_id,
		provider,
	});
}

async function createProductCategoriesEntry({
	category_id,
	product_id,
}: {
	product_id: number | null;
	category_id: number | undefined;
}) {
	if (!category_id || !product_id) {
		return;
	}
	await db.insert(productCategoriesTable).values({
		category_id,
		product_id,
	});
}

export async function addProduct({
	category_id,
	product_description,
	product_image,
	product_name,
	product_price,
	product_provider,
	product_url,
}: CustomProduct) {
	if (
		!product_name ||
		!product_image ||
		!product_description ||
		!product_url ||
		isNaN(product_price) ||
		product_price === 0
	) {
		consoleError(product_provider, `${product_url} is missing metadata`);
		return;
	}
	const item = await db
		.select()
		.from(productsTable)
		.where(
			and(
				eq(productsTable.product_url, product_url),
				eq(productsTable.product_provider, product_provider),
			),
		);
	if (item?.length) {
		consoleInfo(product_provider, `${product_url} exists... Updating...`);
		const [result] = await db
			.update(productsTable)
			.set({
				product_name,
				product_description,
				product_price: BigInt(product_price),
			})
			.where(
				and(
					eq(productsTable.product_url, product_url),
					eq(productsTable.product_provider, product_provider),
				),
			)
			.returning({ id: productsTable.id });

		await createProductCategoriesEntry({
			category_id,
			product_id: result.id,
		});
		await addRecordToProductPricesTable({
			name: product_name,
			description: product_description,
			price: BigInt(product_price),
			product_id: result.id,
			provider: product_provider,
		});
		return;
	}
	const uploadedImagePath = await uploadImage(product_image, product_provider);

	const [result] = await db
		.insert(productsTable)
		.values({
			product_name,
			product_url,
			product_description,
			product_provider,
			product_price: BigInt(product_price),
			product_image: uploadedImagePath,
		})
		.returning({ id: productsTable.id });

	await createProductCategoriesEntry({
		category_id,
		product_id: result.id,
	});
	await addRecordToProductPricesTable({
		name: product_name,
		description: product_description,
		price: BigInt(product_price),
		product_id: result.id,
		provider: product_provider,
	});
	consoleSuccess(product_provider, `Added ${product_url}`);
}
