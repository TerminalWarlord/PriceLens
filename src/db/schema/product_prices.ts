import {
	integer,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { ProductProvider } from "./enums";
import { productsTable } from "./products";

export const productPricesTable = pgTable("product_prices", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	product_id: integer()
		.notNull()
		.references(() => productsTable.id, { onDelete: "cascade" }),
	price: integer().notNull(),
	// vendor may change title/desc for seo/better sale
	name: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	provider: ProductProvider().notNull(),
	recorded_at: timestamp().$default(() => new Date()),
});
