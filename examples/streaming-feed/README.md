# Streaming feed

This self-contained Effront example server-renders six notes, streams subsequent notes, and queries full notes without a page replacement.
It generates 10,000 fictional records in memory.
A database or external service is not necessary for development or production.

## Usage

Prepare the workspace packages as specified in [examples/AGENTS.md](../AGENTS.md).
Then start the Alchemy-managed Cloudflare Worker:

```sh
cd examples/streaming-feed
vp run dev
```

Open the URL that Alchemy reports.
A configured Alchemy profile is necessary for its development command.
The independent browser suite at [`tests/e2e-streaming-feed`](../../tests/e2e-streaming-feed/) executes the same Worker application locally without Cloudflare authentication.

The first six cards are visible without JavaScript.
With JavaScript, **Load 6 more notes** emits cards as the server streams them.
**Read note** queries a detail independently.
An expanded card stays open while more cards load.
You can retry failed requests without the loss of received cards.

## API

- [`src/server-functions.ts`](src/server-functions.ts) defines the typed note query and six-item stream.
- [`src/feed.tsx`](src/feed.tsx) consumes both with Effect cancellation on unmount and retains received cards on retry.

The 10,000 records are deterministic in-memory data. The example does not provide durable storage or database pagination.

_This README was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [README template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/readme/template.md)._
