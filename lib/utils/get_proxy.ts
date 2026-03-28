import { HttpsProxyAgent } from "https-proxy-agent";

const PROXIES = (process.env.PROXIES || "").split("|");
const PROXY_USERNAME = process.env.PROXY_USERNAME || "";
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "";

class ProxyPool {
	private currentIndex = 0;
	private proxies = [] as HttpsProxyAgent<string>[];
	constructor() {
		this.init();
	}
	init() {
		if (!PROXIES.length) {
			throw new Error("No proxies configured");
		}
		for (const proxy of PROXIES) {
			const proxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${proxy}`;
			this.proxies.push(
				new HttpsProxyAgent(proxyUrl, {
					keepAlive: true,
					maxSockets: 60,
					maxFreeSockets: 10,
					timeout: 60000,
				}),
			);
		}
	}

	getProxy() {
		if (!this.proxies.length) {
			throw new Error("No proxy agents available");
		}
		const agent = this.proxies[this.currentIndex];
		this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
		return agent;
	}
}

declare global {
	var proxy_pool: ProxyPool | undefined;
}

export const proxy_pool = globalThis.proxy_pool ?? new ProxyPool();

if (process.env.NODE_ENV !== "production") {
	globalThis.proxy_pool = proxy_pool;
}
