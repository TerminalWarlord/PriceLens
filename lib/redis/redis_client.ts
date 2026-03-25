import Redis from "ioredis";

declare global {
	var redis_client: Redis | undefined;
}

export const redis_client =
	globalThis.redis_client ?? new Redis(process.env.REDIS_URL!);

if (process.env.NODE_ENV !== "production") {
	globalThis.redis_client = redis_client;
}
