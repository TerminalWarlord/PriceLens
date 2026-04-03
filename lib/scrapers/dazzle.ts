import { proxyRequest } from "../utils/proxy_request";
import { consoleError, consoleInfo, consoleLogProduct } from "./debugger";
import { ProductProvider } from "../../types/product_type";
import { MAX_PAGE_LIMIT } from "./scraper_config";
import { isPageProcessed, markPageAsProcessed } from "../redis/redis_helper";
import { addProduct } from "../db_helpers/add_product";
import { addCategory } from "../db_helpers/add_category";
import { processCategories } from "./process_categories";
import { doesProductExist } from "../db_helpers/product_exists";

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

async function getDazzleCategory(slug: string) {
	try {
		const r = await proxyRequest(
			`https://api.dazzle.com.bd/api/v2/categories/${slug}`,
		);
		if (r.status !== 200) {
			consoleError(ProductProvider.DAZZLE, `Failed to fetch category`);
			return;
		}
		const categoryName = r.data?.data?.name;
		if (categoryName) {
			return await addCategory(slug, categoryName, ProductProvider.DAZZLE);
		}
		console.log({ categoryName });
	} catch (err) {
		consoleError(
			ProductProvider.DAZZLE,
			`Failed to extract category: ${slug} : ${err}`,
		);
	}
}

export async function processDazzleCaetgoryProducts(slugPath: string) {
	const categoryId = await getDazzleCategory(slugPath);
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
				if (!productUrl) continue;
				if (await doesProductExist(productUrl, ProductProvider.DAZZLE)) {
					continue;
				}
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
					if (!isAvailable) {
						consoleError(
							ProductProvider.DAZZLE,
							`Product is not in stock ${productUrl}!`,
						);
						continue;
					}
					await addProduct({
						category_id: categoryId,
						product_description: productDescription.trim(),
						product_image: productImage,
						product_name: productName,
						product_price: productPrice,
						product_provider: ProductProvider.DAZZLE,
						product_url: productUrl,
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
		await processCategories(
			new Set(navLinks),
			ProductProvider.DAZZLE,
			processDazzleCaetgoryProducts,
		);
	} catch (err) {
		consoleError(ProductProvider.DAZZLE, `Failed: ${err}`);
	}
}
