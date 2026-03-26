import { HttpsProxyAgent } from "https-proxy-agent";
import { getProxy } from "./get_proxy";
import axios from "axios";

export enum Method {
	GET = "GET",
	POST = "POST",
	PATCH = "PATCH",
	PUT = "PUT",
}

export async function proxyRequest(
	url: string,
	method: Method = Method.GET,
	timeout: number = 100000,
) {
	const agent = new HttpsProxyAgent(getProxy());
	const res = await axios(url, {
		timeout,
		method,
		httpsAgent: agent,
		proxy: false,
		validateStatus: () => true,
	});
	return res;
}
