import { assert } from "vite-plus/test";

import type { CodeLanguage } from "./code-block.tsx";

const escapedText: Readonly<Record<string, string>> = {
  "&#x27;": "'",
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};

export const serializedCodeText = (html: string): string => {
  const body = /<code>(?<body>[\s\S]*?)<\/code>/u.exec(html)?.groups?.["body"];
  assert.isDefined(body);
  const text = body.replaceAll(/<\/?span\b[^>]*>/gu, "");
  return text.replaceAll(/&(?:amp|lt|gt|quot|#x27);/gu, (entity) => escapedText[entity] ?? entity);
};

export const codeFixtures = [
  ["tsx", 'const Page = () => <main title="資料">日本語 🐙</main>;\n'],
  ["typescript", "export type Env = { readonly label: string };\n"],
  ["ts", "const count: number = 42;\n"],
  ["javascript", "export const answer = 42;\n"],
  ["js", 'console.log("hello");\n'],
  ["jsx", "const page = <h1>Hello</h1>;\n"],
  ["json", '{ "label": "Workers", "count": 1 }\n'],
  ["jsonc", '{\n  // Local bindings\n  "vars": { "APP_LABEL": "資料" },\n}\n'],
  ["bash", 'BASE=ed886996\ngit show "$BASE:packages/effective-rsc/package.json"\n'],
  ["sh", "vp install\nvp build\n"],
  ["shell", "(cd tests/e2e && vp run test)\n"],
  ["diff", '--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n-"0.1.4"\n+"0.1.4-workers.0"\n'],
  ["css", ".code { color: #e1e4e8; }\n"],
  ["text", "├─ src/\n└─ 日本語の説明\n"],
] as const satisfies Readonly<Readonly<[CodeLanguage, string]>[]>;
