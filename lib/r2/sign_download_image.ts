import { r2_client } from "./r2_client";

export function signDownloadUrl(key: string, expiresIn: number = 3600) {
	return r2_client.presign(key, {
		expiresIn,
		method: "GET",
	});
}
