import axios from 'axios';
import * as cheerio from 'cheerio';
// TODO: add proxies

export async function scrapeStartechPage(url: string) {
    for (let page = 1; page < 2; page++) {
        const r = await axios.get(url + `?page=${page}`);
        const data = await r.data;
        const $ = cheerio.load(data);
        const items = $(".container").find(".p-item")
        if (items.length === 0) return;
        items.children().each((_, el) => {
            const thumbnail = $(el).find('img').attr('src');
            const shortDescription = $(el).find('.short-description').text().trim();
            const productName = $(el).find('.p-item-name').find('a').text();
            const productUrl = $(el).find('.p-item-name').find('a').attr('href');
            const productPrice = $(el).find('.p-item-price').find('span').first().text().trim().replace(/৳/g, '').replace(/,/g, '');
            console.log(productName, shortDescription, productPrice)
        })
        console.log(items.length)
    }
}


export async function getStartechCategories() {
    const url = "https://www.startech.com.bd/"
    const r = await fetch(url)
    const data = await r.text();
    const $ = cheerio.load(data);
    const allMenu = $("ul.navbar-nav > li.nav-item");
    allMenu.each((_, el) => {
        const navLink = $(el).children('a.nav-link').attr('href');
        if(!navLink) return;
        Promise.resolve(scrapeStartechPage(navLink));
        return;
    })
}