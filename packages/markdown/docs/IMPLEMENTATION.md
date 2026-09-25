# Markdown implementation

## Purpose

This document explains the collection's indexes, resolution algorithm, rendering graphs, and build artifacts for maintainers.
Consumer contracts live in the [English API reference](../../../app/docs/src/content/en/articles/api-reference/markdown.md) and its [Japanese translation](../../../app/docs/src/content/articles/api-reference/markdown.md).

## Responsibilities

Vite owns file discovery and asset emission.
The collection consumes loaded maps rather than implementing a runtime filesystem loader, asset copier, or bundler.
Source-relative path operations use Effect's [`NodePath.layerPosix`](https://effect.website/docs/v4/api/platform-node-shared/NodePath) so slash-separated Vite keys have host-independent semantics.
The source index and public URL index remain separate: reference resolution needs source filenames, while request lookup needs encoded public routes.

## collection.ts の処理フロー

対象: [`packages/markdown/src/collection.ts`](../src/collection.ts)。
このファイルはViteが読み込んだ文字列・アセットURLを索引化します。
Markdownの構文解析とReact描画は別の処理です。

### 1. コレクション生成

`createMarkdownCollection(options)`はEffectを返し、以下の処理はそのEffectを実行したときに行われます。
`documents`は`?raw`の文字列マップ、`assets`は`?url`のURLマップです。

```mermaid
flowchart TD
    A["Effect実行: basePath / documents / assets"] --> P["NodePath.layerPosixからPathサービスを取得"]
    P --> B["basePathをセグメント化"]
    B --> C{"設定条件を満たすか"}
    C -->|いいえ| E["MarkdownErrorでEffect失敗"]
    C -->|はい| D["公開URL索引・ソース索引・アセット索引を作成"]
    D --> F{"未処理のアセットがあるか"}
    F -->|はい| G{"globキーがコレクション基準の相対パスか"}
    G -->|いいえ| E
    G -->|はい| H["キーをセグメント単位でencodeして登録<br/>値はViteのURLをそのまま保持"]
    H --> F
    F -->|いいえ| I{"未処理のMarkdownがあるか"}
    I -->|はい| J{"globキーがコレクション基準の相対パスで<br/>ファイル名が.mdで終わるか"}
    J -->|いいえ| E
    J -->|はい| K["globキーの相対階層とbasePathを結合<br/>.md拡張子だけを除去"]
    K --> L["各セグメントをencodeして公開URLを作成"]
    L --> M{"公開URLが重複するか"}
    M -->|はい| E
    M -->|いいえ| N["本文・URL・参照解決関数を持つEntryを作成<br/>公開URLとソースの両索引へ登録"]
    N --> I
    I -->|いいえ| O["URL順のentries / get / resolveLink / resolveImageを返す"]
```

`Entry.source` remains the source-index key used by diagnostics and relative resolution, not a filesystem loading instruction.

### 2. リクエストURLからEntryを検索

`get(pathname)`は公開 URL 索引を同期的に検索します。

```mermaid
flowchart TD
    A["get: リクエストのpathname"] --> B["最初のquery / fragment以降を取り除く"]
    B --> C{"先頭が / か"}
    C -->|いいえ| X["undefined"]
    C -->|はい| D["単独の末尾 / を除去<br/>連続 / は保持"]
    D --> E["先頭 / を除去してセグメントに分割"]
    E --> F["各セグメントを1回decode<br/>decode失敗時は元の文字列を保持"]
    F --> G["各セグメントを再encodeして索引キーを作成"]
    G --> H{"公開URL索引に存在するか"}
    H -->|はい| Y["MarkdownEntry"]
    H -->|いいえ| X
```

分割してからdecodeするため、セグメント内のencoded slashがディレクトリ境界へ変わることはありません。
ファイル名が文字列として`%20`を含む場合も、URLの`%2520`を二重decodeせず検索します。

### 3. Markdown内のリンク・画像参照を解決

`resolveLink`と`resolveImage`は共通の`resolveLocal`を使うEffectです。
前者はMarkdownファイルをページURLへ解決でき、後者はアセット索引だけを使います。

```mermaid
flowchart TD
    A["resolveLink / resolveImageのEffect実行"] --> B{"参照が # / またはschemeで始まるか"}
    B -->|はい| C["参照をそのまま返す"]
    B -->|いいえ| D["パスとquery / fragmentのsuffixを分離"]
    D --> E{"パスが空か"}
    E -->|はい| F["現在のEntry URL + suffixを返す"]
    E -->|いいえ| G["encodeしたソースパスからPath.dirnameで基準ディレクトリを取得"]
    G --> H["参照を分割し各セグメントを1回decodeして再encode<br/>encoded slashをセグメント内に保持"]
    H --> I["Path.joinで相対参照を結合・正規化"]
    I --> J{"結果が .. または ../ で始まるか"}
    J -->|はい| X["MarkdownErrorでEffect失敗"]
    J -->|いいえ| K["Path.resolveで固定の / 基準の索引キーへ"]
    K --> L{"リンクであり、対象が.mdか"}
    L -->|はい| M["ソース索引からEntryの公開URLを取得"]
    L -->|いいえ| N["アセット索引からViteのURLを取得"]
    M --> O{"対象が見つかったか"}
    N --> O
    O -->|いいえ| X
    O -->|はい| P["取得したURL + suffixを返す"]
```

外部URLやルート相対URLのポリシーはComark・アプリケーション側に委譲します。
アセットの読み込み・変換・出力はViteの担当で、この処理は渡されたURLを検索するだけです。
suffixは文字列として末尾へ追加し、既存URLのqueryを再構成・マージしません。

## Rendering

`parseMarkdown` resolves link/image attributes after the parser plugins, keeping URL resolution independent from rendering.
`@effront/markdown/document` wraps Comark's direct document-rendering entry point with configurable defaults and an `effront-markdown` wrapper class.
It does not import the collection/parser entry point or make the whole article a Client Component.
Only the Math and Mermaid wrappers carry `use client`; they reuse Comark's default components and keep the Mermaid dependency out of the SSR graph.
Mermaid uses [`use(browser())`](https://react.dev/reference/react-dom/browser) inside a `Suspense` boundary to leave its fallback on the server, then [`lazy`](https://react.dev/reference/react/lazy) loads the upstream component in the browser.
React manages loading and retries instead of a wrapper-owned Effect and mounted state.
The document wrapper merges its default component mappings with the caller's mappings using object spread and leaves component resolution to Comark.
The library build copies KaTeX's local fonts and license beside the emitted stylesheet so its relative font URLs survive package publication.
The wrappers do not filter themes, rewrite SVG styles or IDs, or replace upstream invalid-input behavior.

Ordinary prose stays in the server-rendering graph.
Math starts as `...` and Mermaid as an empty container until client effects run; rich no-JavaScript rendering remains deferred in [the roadmap](../../../docs/ROADMAP.md#standard-rendering-and-deferred-rich-ssr).

## Verification

For package checks and unit coverage, use the [package development instructions](../AGENTS.md).
For rendered Markdown and asset behavior, use [built-artifact acceptance](../../../docs/TESTING.md).
For document edits, additions, and deletion, use [development HMR acceptance](../../../docs/TESTING.md).

Typed metadata, relationships, loaders, and richer SSR support remain separate [roadmap items](../../../docs/ROADMAP.md).
