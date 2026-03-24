import type { ProductProvider } from "../../types/product_type";

export function consoleSuccess(provider: ProductProvider, msg: string) {
	console.log(`\x1b[32m[${provider}]\x1b[0m : ${msg}`);
}

export function consoleInfo(provider: ProductProvider, msg: string) {
	console.log(`\x1b[33m[${provider}]\x1b[0m : ${msg}`);
}

export function consoleError(provider: ProductProvider, msg: string) {
	console.log(`\x1b[31m[${provider}]\x1b[0m : ${msg}`);
}

export function consoleLogProduct(
	provider: ProductProvider,
	product: {
		name: string;
		price: number;
		description: string;
		image: string;
	},
) {
	console.log(
		`\x1b[34m[${provider}]\x1b[0m\nNAME: ${product.name}\nPRICE:${product.price}\nDESC:${product.description}\nIMAGE:${product.image}`,
	);
}
