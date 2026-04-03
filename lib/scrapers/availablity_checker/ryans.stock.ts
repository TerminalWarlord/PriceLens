import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../../utils/proxy_request";
import { CF_PROXY } from "../scraper_config";
import { ProductProvider } from "../../../types/product_type";
import { removeProduct } from "./remove_product";
import { changeProductLastUpdated } from "../../db_helpers/updateProduct";

export async function isItemAvailableOnRyans(productUrl: string) {
	const r = await proxyRequest(CF_PROXY + productUrl, Method.GET, 100000);
	const $ = cheerio.load(r.data.result);
	const priceSection = $("div.price-block").text().trim().toLowerCase();
	const isAvailable =
		!priceSection.includes("out of stock") &&
		!priceSection.includes("coming soon");
	if (!isAvailable) {
		await removeProduct(productUrl, ProductProvider.RYANS);
	} else {
		await changeProductLastUpdated(productUrl, ProductProvider.RYANS);
	}
}

// (async () => {
//     await isItemAvailableOnRyans("https://www.ryans.com/apple-macbook-pro-late-2025-apple-m5-chip-32gb-ram-1tb-ssd-laptop");
//     await isItemAvailableOnRyans("https://www.ryans.com/lenovo-thinkpad-e14-gen-7-intel-core-ultra-7-14-inch-display-laptop");
//     await isItemAvailableOnRyans("https://www.ryans.com/hp-omnibook-5-flip-x360-2-in-1-14-fp0136tu-convertible-laptop");
// })()
