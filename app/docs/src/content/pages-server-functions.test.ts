import { Array } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { render, text, textOf } from "./pages-render.fixture.ts";

const editions = ["en", "ja"] as const;
const advertised = (content: string, terms: string[]): string[] =>
  Array.filter(terms, (term) => content.includes(term));
const streamExamples = ["streamFeed", "Stream.runForEach", "Effect.sleep(350)", "controller.abort"];
const failureExamples = [
  "&quot;use server&quot;",
  "import { Effect, Schema } from &quot;effect&quot;",
  "import { EFFRONT } from &quot;./effront&quot;",
  "Effect.catchTags({",
  "ServerFnTransportError",
];

describe("server function guides", () => {
  test.each(editions)(
    "shows the concise query example and links to atom installation in %s",
    async (locale) => {
      const html = await render(`/${locale}/guide/query-server-functions`);
      const query = textOf(html);
      expect(query).not.toMatch(/effective-rsc|AbortSignal|request lifetime|リクエストの生存期間/u);
      expect(advertised(query, ["useAtom(ticketStatus)", "run([{ ticketCode }])"])).toStrictEqual([
        "useAtom(ticketStatus)",
        "run([{ ticketCode }])",
      ]);
      expect(html).toContain(
        'href="https://github.com/Effect-TS/effect/blob/main/packages/atom/react/README.md#installation"',
      );
    },
  );

  test.each(editions)(
    "shows the streaming example, cancellation, and retry in %s",
    async (locale) => {
      const stream = await text(`/${locale}/guide/stream-server-functions`);
      expect(stream).not.toContain("effective-rsc");
      expect(advertised(stream, streamExamples)).toStrictEqual(streamExamples);
      expect(stream).toMatch(/Retry|再試行/u);
    },
  );

  test.each(editions)("documents the shared error handling contracts in %s", async (locale) => {
    const failures = await text(`/${locale}/best-practices/server-function-error-handling`);
    expect(advertised(failures, failureExamples)).toStrictEqual(failureExamples);
  });
});

const pluginOrder = "plugins: [effront(), effrontAlchemy()]";
const warnings = [
  { locale: "en", reversed: "The reverse plugin order" },
  { locale: "ja", reversed: "プラグインの順序を逆にすると" },
] as const;

describe("alchemy plugin order reference", () => {
  test.each(warnings)(
    "describes the correct plugin order before warning about reversing it in $locale",
    async ({ locale, reversed }) => {
      const html = await render(`/${locale}/api-reference/alchemy`);
      const alchemy = textOf(html);
      expect(html).toContain('data-alert="warning"');
      expect(alchemy).toContain(pluginOrder);
      expect(alchemy).toContain(reversed);
      expect(alchemy.indexOf(pluginOrder)).toBeLessThan(alchemy.indexOf(reversed));
    },
  );
});
