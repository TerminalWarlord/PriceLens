import { S3Client } from "bun";

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_ID = process.env.R2_BUCKET_ID!;
const R2_BUCKET_ENDPOINT = process.env.R2_BUCKET_ENDPOINT!;

declare global {
	var r2_client: S3Client | undefined;
}

export const r2_client =
	globalThis.r2_client ??
	new S3Client({
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
		bucket: R2_BUCKET_ID,
		endpoint: R2_BUCKET_ENDPOINT,
	});

if (process.env.NODE_ENV !== "production") {
	globalThis.r2_client = r2_client;
}
