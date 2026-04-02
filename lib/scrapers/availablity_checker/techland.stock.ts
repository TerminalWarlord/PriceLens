import { processTechLandProductDetails } from "../techland";

export async function isItemAvailableOnTechLand(productUrl: string) {
	await processTechLandProductDetails(productUrl);
}

// (async () => {
//     // out of stock
//     await isItemAvailableOnTechLand("https://www.techlandbd.com/acer-aspire-15-as15-42-8gb-laptop");
//     // preorder
//     await isItemAvailableOnTechLand("https://www.techlandbd.com/apple-macbook-pro-m4-max");
//     // up coming
//     await isItemAvailableOnTechLand("https://www.techlandbd.com/lenovo-thinkpad-e14-laptop");
//     // in stock
//     await isItemAvailableOnTechLand("https://www.techlandbd.com/acer-aspire-15-as15-42-laptop");
// })()
