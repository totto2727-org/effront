`@effront/markdown` は、インポートした Markdown をアプリケーションで描画するために、URL で文書を検索できるコレクションと Comark による解析を提供します。
ページへの組み込みは [Markdown](../guide/markdown.md) を参照してください。

## createMarkdownCollection {#collection}

`createMarkdownCollection(options)` は `Effect.Effect<MarkdownCollection, MarkdownError>` を返します。

| `MarkdownCollectionOptions` のフィールド | 契約                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `basePath`                               | 必須の公開絶対パス接頭辞。`/manual` や `/` など。クエリ、フラグメント、`..` による親への移動は不可                        |
| `documents`                              | `.md` のソースキーと Markdown 本文を対応させる必須の `Readonly<Record<string, string>>`。通常は Vite の eager `?raw` glob |
| `assets`                                 | ソースキーとインポート済みアセット URL の対応。省略可能。通常は同じ `base` を使う Vite の eager `?url` glob               |

ソースキーは `./` で始まり、コレクションの基準位置からの相対パスで、`..` セグメントを含まない必要があります。
不正なオプションや公開パスの重複は、Effect 実行時に `MarkdownError` になります。
コレクションの作成と解析はサーバー側で行います。
Cloudflare Workers では Wrangler 設定の `nodejs_compat` が必要です。
サーバーランタイムは `node:path` と `node:url` をサポートする必要があります。

| コレクションのメンバー                                 | 戻り値                                       |
| ------------------------------------------------------ | -------------------------------------------- |
| `get(pathname)`                                        | 同期的な `MarkdownEntry \| undefined` の検索 |
| `entries`                                              | 公開 URL 順の readonly エントリー配列        |
| `resolveLink(entry, href)`、`resolveImage(entry, src)` | [参照解決の Effect](#references)             |

`collection.get("/manual/start")` で、そのサイト内パスの記事を取得します。
該当エントリーがなければ `undefined` を返します。
解析前に、404 レスポンスなどで処理してください。

| `MarkdownEntry` のフィールド             | 値                                      |
| ---------------------------------------- | --------------------------------------- |
| `source`                                 | 元の glob キー                          |
| `content`                                | Markdown 本文                           |
| `url`、`pathname`                        | 同一の公開絶対パス                      |
| `resolveLink(href)`、`resolveImage(src)` | エントリーを基準に参照を解決する Effect |

公開パスは `.md` だけを除き、各セグメントを URL エンコードします。
`basePath: "/manual"` では、`./start.md` は `/manual/start` に、`./index.md` は `/manual` ではなく `/manual/index` になります。

## parseMarkdown {#parse}

`parseMarkdown(entry, options?)` は、Comark の文書型と `ParserOptions` を使い、`Effect.Effect<MarkdownDocument, MarkdownError>` を返します。
Comark の既定設定を保持し、次のプラグインを追加します。

| プラグイン                                                    | 動作                                  |
| ------------------------------------------------------------- | ------------------------------------- |
| `footnotes()`                                                 | 脚注                                  |
| `math()`                                                      | 数式の解析                            |
| `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })` | 明暗で同じテーマを使う Mermaid の解析 |
| `shiki()`                                                     | コードハイライト                      |

`options.plugins` はこれら 4 つの後に追加され、置き換えにはなりません。
Effront が追加するプラグインを削除するオプションはありません。
`registerDefaultPlugins: false` が無効にするのは Comark 自体の既定プラグインだけです。
`linkify` など、その他のオプションは [Comark](https://comark.dev) に従います。

> [!WARNING]
> 対象は信頼できる執筆済み Markdown とプラグインに限ります。
> この parser は sanitizer ではありません。

parser の例外は、元の例外を `cause` に持つ `MarkdownError` になります。

## Markdown のレンダリング {#rendering}

`@effront/markdown/document` の `MarkdownDocument` と `@effront/markdown/styles.css` を import し、解析したドキュメントを `value` に渡します。
この import だけで利用でき、Comark ベースの Math と Mermaid は標準で登録されているため、個別の登録は不要です。

表示を変更するには、`@effront/markdown/math` の `Math` や `@effront/markdown/mermaid` の `Mermaid` を好みのオプションでラップするか、独自のコンポーネントを実装します。
`components={{ Math: MyMath, Mermaid: MyMermaid }}` のように、差し替えるコンポーネントを `MarkdownDocument` の `components` に渡してください。
各コンポーネントのオプションは [Comark React API](https://comark.dev/rendering/react) を参照してください。

> [!WARNING]
> 現状、Math と Mermaid はクライアント JavaScript が必須であり、SSR に対応していません。
> サーバー側では数式と図のレンダリングをスキップし、プレースホルダーのみを出力します。
> SSR が必要な場合は、サーバーでレンダリングできるコンポーネントを独自に実装し、`components` で差し替えてください。

## リンク、アセット、MarkdownError {#references}

`entry.resolveLink(href)` と `entry.resolveImage(src)` は `Effect.Effect<string, MarkdownError>` を返します。
コレクションにも、最初の引数に `entry` を受け取る同等のメソッドがあります。
`parseMarkdown` は、解析とプラグイン実行の後に、文字列の `a.href` と `img.src` をこれらの関数で解決します。

| 参照                                                     | 解決結果                          |
| -------------------------------------------------------- | --------------------------------- |
| 相対 `.md` リンク                                        | インポート済み文書の公開 URL      |
| 相対アセットリンクまたは画像                             | インポート済みアセットの Vite URL |
| フラグメントのみ、`/` 始まり、外部 URL                   | 変更なし                          |
| 相対参照先がない、またはコレクションの基準位置の外を指す | `MarkdownError`                   |

相対参照は、その参照を含む Markdown ファイルのディレクトリを基準に解決します。

`MarkdownError` は `_tag: "MarkdownError"`、診断用の `message`、省略可能な `cause` を持ちます。
コレクション設定、参照解決、parser の失敗を表します。
