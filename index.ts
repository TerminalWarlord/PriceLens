import { config } from "dotenv";
import { Hono } from "hono";
import { getSearchController } from "./controllers/search.controller";

config();

const app = new Hono();

// TODO: add cors, rate limiter

app.get("/search", getSearchController);
app.get("/", (c) => c.text("Hono!"));

Bun.serve({
	port: process.env.PORT,
	fetch: app.fetch,
});
