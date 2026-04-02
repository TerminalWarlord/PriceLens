// import * as cheerio from "cheerio";
// import { proxyRequest } from "../../utils/proxy_request";
// import { CF_PROXY } from "../scraper_config";
// import { db } from "../../db";
// import { productsTable } from "../../../src/db/schema/products";
// import { and, eq } from "drizzle-orm";
// import { ProductProvider } from "../../../types/product_type";
// import { consoleSuccess } from "../debugger";
// import { removeProduct } from "./remove_product";
// import { changeProductLastUpdated } from "./updateProduct";

// export async function isItemAvailableOnComputerVillage(productUrl: string) {
//     const r = await proxyRequest(CF_PROXY + productUrl);
//     const $ = cheerio.load(r.data);
//     console.log(r.data)
//     const priceSection = $("div#content li.product-stock").text().trim().toLowerCase();
//     const isAvailable = priceSection.includes("in stock");
//     console.log(isAvailable, $("#content").toString())
//     if (!isAvailable) {
//         await removeProduct(productUrl, ProductProvider.COMPUTER_VILLAGE);
//     }
//     else {
//         await changeProductLastUpdated(productUrl, ProductProvider.COMPUTER_VILLAGE)
//     }
// }

// // (async () => {
// //     // in stock
// //     await isItemAvailableOnComputerVillage("https://www.computervillage.com.bd/asus-vivobook-go-15-l510ka-celeron-n4500-fhd-laptop");
// //     // out of stock
// //     await isItemAvailableOnComputerVillage("https://www.computervillage.com.bd/Asus-E203MAH-Intel-CDC-N4000-4GB-DDR4-500GB-HDD-116-Inch-Display-Notebook-LGpfN");
// // })()
