import * as cheerio from "cheerio";
import { proxyRequest } from "../utils/proxy_request";
import { consoleError, consoleInfo, consoleLogProduct } from "./debugger";
import { ProductProvider } from "../../types/product_type";
import { MAX_PAGE_LIMIT, PLIMIT } from "./scraper_config";
import { db } from "../../src";
import { productsTable } from "../../src/db/schema/products";
import { and, eq } from "drizzle-orm";
import { uploadImage } from "../r2/upload_image";
import { productPricesTable } from "../../src/db/schema/product_prices";
import pLimit from "p-limit";
import { processItemWithTimeout } from "../utils/process_helper";
import {
	isCategoryProcessed,
	isPageProcessed,
	markPageAsProcessed,
} from "../redis/redis_helper";

interface DazzleProduct {
	name: string;
	slug: string;
	thumbnail: string;
	price: {
		price: number;
	};
	specifications: {
		[key: string]: {
			name: string;
			value: string;
		}[];
	};
	status: string; //stock->available
}

export async function processDazzleProductUrl(slugPath: string) {
	try {
		for (let page = 1; page < MAX_PAGE_LIMIT; page++) {
			const pageUrl = `https://api.dazzle.com.bd/api/v2/categories/${slugPath}/products?fields=id,name,slug,meta,created_at,brand_id&sort=-hot&filter[brand_id]=&page[size]=100&page[number]=${page}&include=price,category,brand,variantsCount,stock,attributes,campaigns.discounts`;
			if (await isPageProcessed(pageUrl)) {
				consoleInfo(ProductProvider.DAZZLE, `Processed : ${pageUrl}`);
				continue;
			}
			const r = await proxyRequest(pageUrl);
			consoleInfo(ProductProvider.DAZZLE, `Scraping : ${pageUrl}`);
			console.log(r.status);
			if (r.status !== 200 || !r.data.data.length) {
				consoleError(
					ProductProvider.DAZZLE,
					`No more items left in ${slugPath}`,
				);
				break;
			}
			const products = r.data.data as DazzleProduct[];
			console.log(products[0].name);
			for (const product of products) {
				const productUrl = "https://dazzle.com.bd/product/" + product.slug;
				try {
					const productName = product.name;
					const productPrice = Number(product?.price?.price) * 100;
					const productImage = product.thumbnail;
					const isAvailable = product.status === "stock";
					let productDescription = "";
					for (const item in product.specifications) {
						for (const field of product.specifications[item]) {
							productDescription += `${field.name} : ${field.value}\n`;
						}
					}
					productDescription = productDescription.trim();
					consoleLogProduct(ProductProvider.DAZZLE, {
						name: productName,
						description: productDescription,
						price: productPrice,
						image: productImage,
					});
					if (!isAvailable) {
						consoleError(
							ProductProvider.DAZZLE,
							`Product is not in stock ${productUrl}!`,
						);
						continue;
					}
					if (
						!productName ||
						!productImage ||
						!productDescription ||
						!productUrl ||
						isNaN(productPrice) ||
						productPrice === 0
					) {
						consoleError(
							ProductProvider.DAZZLE,
							`Metadata missing ${{
								name: productName,
								description: productDescription,
								price: productPrice,
								image: productImage,
							}}`,
						);
						continue;
					}

					const item = await db
						.select()
						.from(productsTable)
						.where(
							and(
								eq(productsTable.product_url, productUrl),
								eq(productsTable.product_provider, ProductProvider.DAZZLE),
							),
						);
					if (item && item.length) {
						continue;
					}
					const uploadedImagePath = await uploadImage(
						productImage,
						ProductProvider.DAZZLE,
					);

					const [result] = await db
						.insert(productsTable)
						.values({
							product_name: productName,
							product_url: productUrl,
							product_price: BigInt(productPrice),
							product_description: productDescription,
							product_image: uploadedImagePath,
							product_provider: ProductProvider.DAZZLE,
						})
						.returning({ id: productsTable.id });

					await db.insert(productPricesTable).values({
						name: productName,
						description: productDescription,
						price: BigInt(productPrice),
						product_id: result.id,
						provider: ProductProvider.DAZZLE,
					});
				} catch (err) {
					consoleError(
						ProductProvider.DAZZLE,
						`Failed to extract data for ${productUrl} : ${err}`,
					);
				}
			}

			await markPageAsProcessed(pageUrl);
		}
	} catch (err) {
		consoleError(ProductProvider.DAZZLE, `Failed: ${err}`);
	}
}

export async function scrapeDazzleCategories() {
	try {
		const r = await proxyRequest(
			"https://api.dazzle.com.bd/api/v2/categories?sort=-created_at",
		);
		if (r.status !== 200) {
			throw new Error(`Failed to scrape categories: ${r.status}`);
		}
		const navLinks: string[] = r.data.data.map(
			(item: { slug_path: string }) => item.slug_path,
		);

		const categoryLimit = pLimit(PLIMIT);
		const tasks = Array.from(navLinks).map((navLink) =>
			categoryLimit(async () => {
				try {
					if (!navLink) return;
					if (await isCategoryProcessed(navLink, ProductProvider.DAZZLE)) {
						consoleInfo(
							ProductProvider.DAZZLE,
							`Category already processed ${navLink}`,
						);
						return;
					}
					consoleInfo(ProductProvider.DAZZLE, `Scraping ${navLink}`);
					await processItemWithTimeout(processDazzleProductUrl(navLink));
				} catch (err) {
					consoleError(ProductProvider.DAZZLE, `Scraping ${navLink}`);
				}
			}),
		);
		await Promise.all(tasks);
		consoleInfo(ProductProvider.DAZZLE, `Processed all categories`);
	} catch (err) {
		consoleError(ProductProvider.DAZZLE, `Failed: ${err}`);
	}
}
