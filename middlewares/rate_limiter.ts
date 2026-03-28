import type { Context, Next } from "hono";
import { redis_client } from "../lib/redis/redis_client";

export const rateLimiter = async (c: Context, next: Next) => {
	const ip =
		c.req.header("x-forwarded-for")?.split(",")[0] || c.req.header("x-real-ip");
	const key = `rate:${ip}`;
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
