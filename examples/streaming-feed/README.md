# Streaming feed

A self-contained Effront example that server-renders six notes, streams subsequent notes, and queries full notes without replacing the page. It generates 10,000 fictional records in memory, so neither development nor production needs a database or external service.

## Usage

After preparing workspace packages as described in [examples/AGENTS.md](../AGENTS.md), start the Alchemy-managed Cloudflare Worker:

```sh
cd examples/streaming-feed
vp run dev
```

Open the URL reported by Alchemy. Its development command requires a configured Alchemy profile; the independent browser suite at [`tests/e2e-streaming-feed`](../../tests/e2e-streaming-feed/) runs the same Worker application locally without Cloudflare authentication.

The first six cards are visible without JavaScript. With JavaScript, **Load 6 more notes** emits cards as the server streams them. **Read note** queries a detail independently, so an expanded card stays open while more cards load. Failed requests can be retried without losing received cards.

## API

- [`src/server-functions.ts`](src/server-functions.ts) defines the typed note query and six-item stream.
- [`src/feed.tsx`](src/feed.tsx) consumes both with Effect cancellation on unmount and retains received cards on retry.

The 10,000 records are deterministic in-memory data. The example does not provide durable storage or database pagination.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
