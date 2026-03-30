import { r2_client } from "./r2_client";

const EXT_TO_CONTENT_TYPE_MAP = {
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	// top 4 are widely used, adding gif and svg just in case
	gif: "image/gif",
	svg: "image/svg+xml",
} as const;

export async function uploadImage(imageUrl: string, provider: string) {
	const url = new URL(imageUrl);
	const actualUrl = url.searchParams.get("url") || imageUrl;
	const updatedUrl = new URL(actualUrl);
	const r = await fetch(actualUrl);
	if (!r.ok) {
		throw new Error(`Failed to get image from ${imageUrl}`);
	}
	const cleanPath = decodeURIComponent(updatedUrl.pathname);
	const fileName = cleanPath.split("/").pop();
	if (!fileName) {
		throw Error("Failed to get filename while uploading");
	}

	const buffer = await r.arrayBuffer();
	if (buffer.byteLength === 0) {
		throw new Error(
			`Failed to get image from ${imageUrl}! Seems like a blank image!`,
		);
	}
	const newFileName = `${provider.toLocaleLowerCase()}/${fileName}`;
	const fileExt =
		r.headers.get("Content-Type") ||
		EXT_TO_CONTENT_TYPE_MAP[fileName as keyof typeof EXT_TO_CONTENT_TYPE_MAP] ||
		"image/jpeg";
	console.log(fileName);
	await r2_client.file(newFileName).write(buffer, {
		type: fileExt,
	});

	return newFileName;
}
