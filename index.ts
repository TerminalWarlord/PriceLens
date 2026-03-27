import { config } from "dotenv";
import { Hono } from "hono";
import { getSearchController } from "./controllers/search.controller";
import { cors } from "hono/cors";
import { rateLimiter } from "./middlewares/rate_limiter";

config();

const app = new Hono();

app.use(
	cors({
		origin: ["http://localhost:5173", "https://pricelens.joybiswas.com"],
	}),
);

app.get("/", rateLimiter, (c) => c.text("Hello!"));
app.get("/search", rateLimiter, getSearchController);

Bun.serve({
	port: process.env.PORT,
	fetch: app.fetch,
});
