import { config } from "dotenv";

config();

// import { getStartechProductDetails, getStartechCategories } from "./lib/scrapers/startech/startech";
// import { getProxy } from "./lib/utils/get_proxy";
// import { getRyansCategories, getRyansProductDetails } from "./lib/scrapers/ryans/ryans";
import { scrapeTechlandCategories } from "./lib/scrapers/techland";

// await getStartechProductDetails('https://www.startech.com.bd/desktops')
// await getStartechCategories()
// await getRyansCategories();
// await getRyansProductDetails('https://www.ryans.com/category/desktop-pc-brand-desktop-pc')
await scrapeTechlandCategories();
// await getTechlandProductDetails('https://www.techlandbd.com/shop-laptop-computer/brand-laptops');
// await processProductUrl('https://www.techlandbd.com/lenovo-pro-5-16adr10-rtx-5060-8gb-graphics-laptop');
