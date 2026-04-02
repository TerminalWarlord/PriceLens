import { processAppleGadgetsProductDetails } from "../apple_gadgets";

export async function isItemAvailableOnAppleGadgets(productUrl: string) {
	await processAppleGadgetsProductDetails(productUrl);
}

// (async () => {
//     // in stock
//     await isItemAvailableOnAppleGadgets("https://www.applegadgetsbd.com/product/microsoft-surface-laptop-5-riq-00001-12th-1265u-multi-touch-laptop");
//     // out of stock
//     await isItemAvailableOnAppleGadgets("https://www.applegadgetsbd.com/product/macbook-air-m3-13-inch-16gb256gb-8-core-cpu-8-core-gpu");
// })()
