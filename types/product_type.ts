export enum ProductProvider {
	STARTECH = "STARTECH",
	RYANS = "RYANS",
	TECHLAND = "TECHLAND",
	COMPUTER_VILLAGE = "COMPUTER_VILLAGE",
	TECH_MARVELS = "TECH_MARVELS",
	VERTECH = "VERTECH",
	APPLE_GADGETS = "APPLE_GADGETS",
}

export enum SortBy {
	RELEVANCE = "relevance",
	PRODUCT_PRICE = "product_price",
	CREATED_AT = "created_at",
	UPDATED_AT = "updated_at",
}

export interface Product {
	id: number;
	product_name: string;
	product_price: bigint;
	product_description: string;
	product_provider: ProductProvider;
	product_url: string;
	product_image: string;
	created_at: Date;
	updated_at: Date;
}
