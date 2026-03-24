# PriceLens - Gadget Price Comparator

Pricelens is a hobby projects that scrapes tech products and their prices from multiple Bangladeshi retailers (startech, ryans, techland etc.) for you to compare the best deal.

<p align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=bun,cloudflare,postgres,redis" />
  </a>
</p>

[![Hono](https://img.shields.io/badge/Built%20with-Hono-orange?style=for-the-badge&logo=https://hono.dev/images/logo.svg&logoColor=white)](https://hono.dev)

## ✨ Features

- 🔍 Scrapes product data from multiple tech stores
- 💰 Compare prices across vendors in one place
- ⚡ Fast search powered by MeiliSearch
- 🖼️ Image storage using Cloudflare R2
- 🚀 High-performance backend using Bun + Hono
- 🧠 Efficient caching with Redis

## 🧱 Tech Stack

### Backend

- Runtime: Bun
- Framework: Hono
- Database: PostgreSQL
- ORM: Drizzle ORM
- Caching: Redis
- Search Engine: Self-hosted MeiliSearch
- Cloudflare R2 (for storing product images)

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.3. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
