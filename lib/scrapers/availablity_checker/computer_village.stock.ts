import * as cheerio from "cheerio";
import { Method, proxyRequest } from "../../utils/proxy_request";
import { CF_PROXY } from "../scraper_config";
import { ProductProvider } from "../../../types/product_type";
import { removeProduct } from "./remove_product";
import { changeProductLastUpdated } from "../../db_helpers/updateProduct";

export async function isItemAvailableOnComputerVillage(productUrl: string) {
	const r = await proxyRequest(CF_PROXY + productUrl, Method.GET, 50000);
	if (r.status !== 200 || r.data.error) {
		throw new Error("Failed to get product");
	}
	const $ = cheerio.load(r.data.result);
	const priceSection = $("div#content li.product-stock")
		.text()
		.trim()
		.toLowerCase();
	const isAvailable = priceSection.includes("in stock");
	if (!isAvailable) {
		await removeProduct(productUrl, ProductProvider.COMPUTER_VILLAGE);
	} else {
		await changeProductLastUpdated(
			productUrl,
			ProductProvider.COMPUTER_VILLAGE,
		);
	}
}

// (async () => {
//     // in stock
//     await isItemAvailableOnComputerVillage("https://www.computervillage.com.bd/asus-vivobook-go-15-l510ka-celeron-n4500-fhd-laptop");
//     // out of stock
//     await isItemAvailableOnComputerVillage("https://www.computervillage.com.bd/Asus-E203MAH-Intel-CDC-N4000-4GB-DDR4-500GB-HDD-116-Inch-Display-Notebook-LGpfN");
// })()
