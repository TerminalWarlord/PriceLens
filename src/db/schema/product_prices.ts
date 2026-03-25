import {
	bigint,
	integer,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { ProductProvider } from "./enums";
import { productsTable } from "./products";

// NOTICE: This table might not make any sense for this project
// but I'm keeping track of the historic data of products
// using this table, which I will later use for a machine learning
// project

export const productPricesTable = pgTable("product_prices", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	product_id: integer()
		.notNull()
		.references(() => productsTable.id, { onDelete: "cascade" }),
	price: bigint({ mode: "bigint" }).notNull(),
	// vendor may change title/desc for seo/better sale
	name: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	provider: ProductProvider().notNull(),
	recorded_at: timestamp().$default(() => new Date()),
});
