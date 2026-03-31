import * as cheerio from "cheerio";
import { ProductProvider } from "../../types/product_type";

export function getCategoryFromProvider(
	provider: ProductProvider,
	$: cheerio.CheerioAPI,
) {
	if (provider === ProductProvider.APPLE_GADGETS) {
		return $("main.container h1").first().text().trim();
	} else if (provider === ProductProvider.TECHLAND) {
		return $(".container ul.flex.items-center li").last().text().trim();
	} else if (provider === ProductProvider.STARTECH) {
		return $("ul.breadcrumb").find("li").last().text().trim();
	} else if (provider === ProductProvider.SKYLANDBD) {
		return $("ul.breadcrumb li").last().text().trim();
	} else if (provider === ProductProvider.COMPUTER_VILLAGE) {
		return $("ul.breadcrumb li").last().text().trim();
	} else if (provider === ProductProvider.TECH_MARVELS) {
		return $("nav.woocommerce-breadcrumb span.wd-last").text().trim();
	} else if (provider === ProductProvider.UCC) {
		return $("ul.breadcrumb li").last().text().trim();
	}
}
