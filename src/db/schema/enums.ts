import { pgEnum } from "drizzle-orm/pg-core";

export const ProductProvider = pgEnum("product_provider", [
	"STARTECH",
	"RYANS",
	"TECHLAND",
]);
