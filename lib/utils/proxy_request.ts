import axios from "axios";
import { proxy_pool } from "./get_proxy";

export enum Method {
	GET = "GET",
	POST = "POST",
	PATCH = "PATCH",
	PUT = "PUT",
}

export async function proxyRequest(
	url: string,
	method: Method = Method.GET,
	timeout: number = 15000,
) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);
	const agent = proxy_pool.getProxy();
	try {
		const res = await axios(url, {
			method,
			signal: controller.signal,
			httpsAgent: agent,
			proxy: false,
			validateStatus: () => true,
		});
		return res;
	} finally {
		clearTimeout(timeoutId);
	}
}
