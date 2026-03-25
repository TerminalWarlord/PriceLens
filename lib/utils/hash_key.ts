import { createHash } from "crypto";

export function generateHash(key: string) {
	return createHash("sha256").update(key).digest("hex");
}
