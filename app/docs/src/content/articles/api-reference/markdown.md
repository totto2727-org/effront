## createMarkdownCollection {#collection}

`@effront/markdown` は `createMarkdownCollection(options)`、`parseMarkdown(entry, options?)`、`MarkdownError` と collection types を公開します。
collection の戻り値は `Effect<MarkdownCollection, MarkdownError>` です。

| 入力        | 契約                                              |
| ----------- | ------------------------------------------------- |
| `basePath`  | `/manual` や `/` の絶対公開 prefix                |
| `documents` | 同じ base を持つ Vite の eager raw `.md` glob map |
| `assets`    | optional な Vite URL-string glob map              |

collection の `entries` はソートされた記事一覧、`get(pathname)` は純粋な lookup です。
未知の URL は `undefined` です。
entry は `source`、`content`、`url`、`pathname` と参照 resolver を持ちます。
`.md` だけを取り除き、各 segment を URL encode します。
lookup は一度だけ decode し、末尾 slash を一つ許容します。
`index.md` の暗黙 alias はありません。

## 参照の解決 {#references}

`entry.resolveLink(href)`、`entry.resolveImage(src)` と collection 側の対応する resolver は `Effect<string, MarkdownError>` を返します。
相対 `.md` は登録済みの文書、相対 asset は登録済みの asset が対象です。
未解決参照、collection 外への参照、重複 route、不正な設定は型付きの失敗です。
fragment-only・site-absolute・external references はそのまま通します。
query と fragment は保持し、asset の URL へ suffix をそのまま追加します。
既存 URL の query / fragment と merge はしないので、競合する suffix を重ねないでください。

内部のパス処理には `node:path` と `node:url` が必要です。
Workers のホストでは `nodejs_compat` を有効にします。
ファイルを読むのは Vite で、runtime filesystem loader はありません。

## parseMarkdown と renderer {#parse}

`parseMarkdown` は標準 Comark document を返す Effect です。
標準 parser に footnotes、math、mermaid、shiki plugins を加え、指定された plugins をその後に追加します。
parse 後の literal `a.href` と `img.src` を解決し、dynamic bindings と application components は維持します。
parser exception は元の `cause` を保持する `MarkdownError` になります。

`MarkdownDocument` を `@comark/react/components/MarkdownDocument` から import して、そのまま使います。
`components={{ ProseA: MyLink }}` などの標準 mapping を渡せます。
parser は未信頼投稿の sanitizer ではありません。
Comark 0.6.2 は Math / Mermaid React components や `document.meta.components` を自動登録しません。
完全な Math / Mermaid SSR は保証しません。

実装例は [Markdown guide](../guide/markdown.md)、一般の renderer API は [Comark React documentation](https://comark.dev/rendering/react) を参照してください。
