CREATE TYPE "public"."product_provider" AS ENUM('STARTECH', 'RYANS', 'TECHLAND');--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_prices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"price" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"provider" "product_provider" NOT NULL,
	"recorded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_name" varchar(255) NOT NULL,
	"product_price" integer NOT NULL,
	"product_description" text NOT NULL,
	"product_provider" "product_provider" NOT NULL,
	"product_url" varchar(255) NOT NULL,
	"product_image" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;