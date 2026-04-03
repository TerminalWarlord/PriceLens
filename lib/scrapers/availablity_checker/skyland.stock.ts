import * as cheerio from "cheerio";
import { proxyRequest } from "../../utils/proxy_request";
import { CF_PROXY } from "../scraper_config";
import { ProductProvider } from "../../../types/product_type";
import { removeProduct } from "./remove_product";
import { changeProductLastUpdated } from "../../db_helpers/updateProduct";

export async function isItemAvailableOnSkyLand(productUrl: string) {
	const r = await proxyRequest(productUrl);
	const $ = cheerio.load(r.data);
	const priceSection = $("div#product ul.product-info-list")
		.text()
		.trim()
		.toLowerCase();
	const isAvailable = priceSection.includes("in stock");
	if (!isAvailable) {
		await removeProduct(productUrl, ProductProvider.SKYLANDBD);
	} else {
		await changeProductLastUpdated(productUrl, ProductProvider.SKYLANDBD);
	}
}

// (async () => {
//     // out of stock
//     await isItemAvailableOnSkyLand("https://www.skyland.com.bd/acer-travelmate-tmp214-54-core-i5-12th-gen-laptop");
//     // in stock
//     await isItemAvailableOnSkyLand("https://www.skyland.com.bd/hyperx-cloud-iii-wired-gaming-headset");
// })()
