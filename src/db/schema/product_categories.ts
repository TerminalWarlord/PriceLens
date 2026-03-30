import { index, integer, pgTable, unique, varchar } from "drizzle-orm/pg-core";
import { ProductProvider } from "./enums";
import { productsTable } from "./products";

export const categoriesTable = pgTable(
	"categories",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		name: varchar({ length: 255 }).notNull(),
		provider_category_slug: varchar({ length: 255 }).notNull(),
		provider: ProductProvider().notNull(),
		pricelens_slug: varchar({ length: 255 }).notNull(),
	},
	(d) => [
		unique("provider_slug_provider_unique").on(
			d.provider_category_slug,
			d.provider,
		),
		index("provider_url").on(d.provider_category_slug, d.provider),
	],
);

export const productCategoriesTable = pgTable("product_categories", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	category_id: integer()
		.notNull()
		.references(() => categoriesTable.id, { onDelete: "cascade" }),
	product_id: integer()
		.notNull()
		.references(() => productsTable.id, { onDelete: "cascade" }),
});
