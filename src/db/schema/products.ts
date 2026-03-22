import { integer, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { ProductProvider } from "./enums";


export const productsTable = pgTable("products", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    product_name: varchar({ length: 255 }).notNull(),
    product_price: integer().notNull(),
    product_description: text().notNull(),
    product_provider: ProductProvider().notNull(),
    product_url: varchar({ length: 255 }).notNull(),
    product_image: varchar({ length: 255 }).notNull(),
    created_at: timestamp().defaultNow(),
    updated_at: timestamp().$default(() => new Date())
}, (t) => [
    unique('provider_url_unique').on(t.product_provider, t.product_url)
]);