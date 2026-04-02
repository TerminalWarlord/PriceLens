import { processStartechProductDetails } from "../startech";

export async function isItemAvailableOnStarTech(productUrl: string) {
	await processStartechProductDetails(productUrl);
}

// (async () => {
//     // out of stock
//     await isItemAvailableOnStarTech("https://www.startech.com.bd/hp-15-fc0659au-r5-7520u-laptop");
//     // preorder
//     await isItemAvailableOnStarTech("https://www.startech.com.bd/msi-raider-18-hx-a14vig-i9-14th-gen-18-inch-gaming-laptop");
//     // up coming
//     await isItemAvailableOnStarTech("https://www.startech.com.bd/walton-tamarind-zx3700-core-i3-laptop");
//     // in stock
//     await isItemAvailableOnStarTech("https://www.startech.com.bd/hp-15-fc0355au-laptop");
// })()
