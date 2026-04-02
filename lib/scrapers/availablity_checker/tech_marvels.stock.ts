import { processTechMarvelsProductDetails } from "../tech_marvels";

export async function isItemAvailableOnTechMarvels(productUrl: string) {
	await processTechMarvelsProductDetails(productUrl);
}

// (async () => {
//     // out of stock
//     await isItemAvailableOnTechMarvels("https://techmarvels.com.bd/product/acer-predator-helios-neo-16-2024-model-16%e2%80%b3-165hz-wuxga-i5-14500hx-16gb-ddr5-ram-1tb-ssd-rtx-4050-6gb-gddr6-w11/");
//     // preorder
//     await isItemAvailableOnTechMarvels("https://techmarvels.com.bd/product/asus-rog-strix-g16-g614pm-ryzen-9-8940hx-rtx5060-gaming-laptop/");
// })()
