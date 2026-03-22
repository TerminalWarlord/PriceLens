const PROXIES = (process.env.PROXIES || "").split("|");
const PROXY_USERNAME = process.env.PROXY_USERNAME || "";
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "";

export function getProxy() {
	const idx = Math.floor(Math.random() * PROXIES.length);
	return `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXIES[idx]}`;
}
