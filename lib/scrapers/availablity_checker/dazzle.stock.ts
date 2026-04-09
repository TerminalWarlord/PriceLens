import * as cheerio from "cheerio";
import { proxyRequest } from "../../utils/proxy_request";
import { ProductProvider } from "../../../types/product_type";
import { removeProduct } from "./remove_product";
import { changeProductLastUpdated } from "../../db_helpers/updateProduct";

export async function isItemAvailableOnDazzle(productUrl: string) {
	const r = await proxyRequest(productUrl);
	if (r.status !== 200) {
		throw new Error("Failed to get product");
	}
	const $ = cheerio.load(r.data);
	const priceSection = $("div.normal-case").eq(0).text().trim().toLowerCase();
	const isAvailable = priceSection.includes("in stock");
	if (!isAvailable) {
		await removeProduct(productUrl, ProductProvider.DAZZLE);
	} else {
		await changeProductLastUpdated(productUrl, ProductProvider.DAZZLE);
	}
}

// (async () => {
//     // in stock
//     await isItemAvailableOnDazzle("https://dazzle.com.bd/product/oppo-find-x9-pro");
//     // TBA
//     await isItemAvailableOnDazzle("https://dazzle.com.bd/product/motorola-moto-g-play-2024");
//     // out of stock
//     await isItemAvailableOnDazzle("https://dazzle.com.bd/product/motorola-moto-x50-ultra");
// })()
