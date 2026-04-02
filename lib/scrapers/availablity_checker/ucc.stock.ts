import { processUCCProductDetails } from "../ucc";

export async function isItemAvailableOnUCC(productUrl: string) {
	await processUCCProductDetails(productUrl);
}

// (async () => {
//     // in stock
//     await isItemAvailableOnUCC("https://www.ucc.com.bd/msi-raider-18-hx-ai-a2xwig-intel-core-ultra-9-285hx-rtx-5080-gaming-laptop");
//     // out stock
//     await isItemAvailableOnUCC("https://www.ucc.com.bd/msi-modern-15-f13mg-intel-core-i7-1355u-intel-iris-xe-graphics-platinum-gray-laptop");
// })()
