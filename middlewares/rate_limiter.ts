import type { Context, Next } from "hono";
import { getConnInfo } from "hono/bun";
import { redis_client } from "../lib/redis/redis_client";

export const rateLimiter = async (c: Context, next: Next) => {
	const info = getConnInfo(c);
	const key = `rate:${info.remote.address}`;
	const limit = 100;
	const window = 60;
	const current = await redis_client.incr(key);
	if (current === 1) {
		await redis_client.expire(key, window);
	}
	if (current > limit) {
		return c.json(
			{
				error: "Too many requests",
			},
			429,
		);
	}
	await next();
};
