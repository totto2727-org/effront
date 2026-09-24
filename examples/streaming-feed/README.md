# Streaming feed

A self-contained Effront example that server-renders six notes, streams subsequent notes, and queries full notes without replacing the page. It generates 10,000 fictional records in memory, so neither development nor production needs a database or external service.

## Usage

Prepare workspace packages from the repository root, then start Vite development:

```sh
vp install
vp exec --filter "./packages/*" -- vp pack
cd examples/streaming-feed
vp dev
```

Open <http://127.0.0.1:18220>. To run the native Node production host from this example directory, use `vp build` and `vp run start`. Set `PORT` and `HOST` to override its default `127.0.0.1:18220` listener.

The first six cards are visible without JavaScript. With JavaScript, **Load 6 more notes** emits cards as the server streams them. **Read note** queries a detail independently, so an expanded card stays open while more cards load. Failed requests can be retried without losing received cards.

## API

- [`src/server-functions.ts`](src/server-functions.ts) defines the typed note query and six-item stream.
- [`src/feed.tsx`](src/feed.tsx) consumes both with Effect cancellation on unmount and retains received cards on retry.
- [`e2e/feed.e2e.ts`](e2e/feed.e2e.ts) exercises no-JavaScript SSR, incremental delivery, retry, and stream cancellation in both Vite development and Node production.

Unlike the upstream Bun showcase, this example uses deterministic in-memory data so the same service works under Vite's Node development host and the built Node listener. It does not demonstrate durable storage or database pagination.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
