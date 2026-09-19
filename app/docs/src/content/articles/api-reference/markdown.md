`@effront/markdown` を使うと、ページのリクエストに対応する文書を Vite で読み込んだ Markdown から選び、文書内のリンクはソースファイルからの相対パスで記述できます。
このリファレンスでは、文書の選択、parser の設定、リンクを公開 URL に変換するルールを確認できます。
ページを実装する一連の手順は [Markdown guide](../guide/markdown.md) を参照してください。

## createMarkdownCollection: 文書の取得 {#collection}

`createMarkdownCollection(options)` を呼び出して、アプリケーションで表示する文書を準備します。
戻り値は `Effect<MarkdownCollection, MarkdownError>` です。
この Effect を実行すると、文書の取得に使うコレクションが得られます。
公開されている `MarkdownCollectionOptions` 型は、次の入力を定義します。

| オプション  | 指定する内容                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `basePath`  | `/manual` や `/` などの公開パスの接頭辞。絶対パスで指定し、クエリ、フラグメント、`..` による親への移動は含めない                       |
| `documents` | `.md` ファイルを読み込む Vite の eager `?raw` glob map。値は Markdown 文字列、キーは glob の `base` を基準にした `./` で始まる相対パス |
| `assets`    | リンク先のファイルや画像を読み込む、省略可能な Vite の eager `?url` glob map。文書と同じ `base` を使う                                 |

コレクションの作成と解析はサーバー側で行ってください。
Cloudflare Workers では、Wrangler 設定で `nodejs_compat` を有効にします。
公開パスの重複などの設定エラーは、コレクションの Effect を実行したときに `MarkdownError` になります。

要求された文書を取得するには、`/manual/start` のような絶対パスを `collection.get(pathname)` に渡します。
これは同期的な取得処理で、一致する文書があれば `MarkdownEntry`、なければ `undefined` を返します。
文書がない場合は、`parseMarkdown` に entry を渡す前に、ルート側で 404 を返すなどの処理をしてください。
要求された1件ではなく文書全体が必要な場合は、公開 URL 順にソートされた `collection.entries` を使います。

各 entry は、Markdown 本文を `content` に、元の glob キーを `source` に持ちます。
`url` と `pathname` は、どちらも同じ公開絶対パスです。
公開されている `MarkdownEntry` と `MarkdownCollection` 型は、[参照解決メソッド](#references)を含めてこれらの戻り値を定義します。

**ファイル名と公開パス**

文書の公開パスは、`.md` だけを取り除き、パスの各要素を URL エンコードして作ります。
`basePath: "/manual"` では、`./start.md` は `/manual/start` に対応し、`./index.md` は `/manual` ではなく `/manual/index` に対応します。
取得時には URL エスケープを一度だけデコードし、末尾のスラッシュを一つ許容し、クエリとフラグメントは無視します。

## parseMarkdown: 解析と描画 {#parse}

選んだ entry を `parseMarkdown(entry, options?)` に渡します。
戻り値は `Effect<MarkdownDocument, MarkdownError>` で、この `MarkdownDocument` は Comark の解析済み文書の型です。
描画するには、`@comark/react/components/MarkdownDocument` から import した `MarkdownDocument` の `value` prop にその文書を渡します。
文書の選択と表示は分けて扱えるため、要素をアプリケーション独自のコンポーネントで表示したい場合は、renderer の標準の `components` prop に `components={{ ProseA: MyLink }}` のような対応を指定してください。
renderer の API は [Comark React documentation](https://comark.dev/rendering/react) を参照してください。

**既定で有効になるもの**

`parseMarkdown(entry)` は Comark の既定設定を維持したうえで、次のプラグインを追加します。

| プラグイン                                                    | 追加される動作                        |
| ------------------------------------------------------------- | ------------------------------------- |
| `footnotes()`                                                 | 脚注の解析                            |
| `math()`                                                      | 数式の解析                            |
| `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })` | 明暗で同じテーマを使う Mermaid の解析 |
| `shiki()`                                                     | コードハイライト                      |

これらの parser の既定設定だけで、数式と Mermaid を SSR で完全に描画できるわけではありません。
Comark 0.6.2 は対応する React コンポーネントを自動登録せず、`document.meta.components` を renderer のコンポーネント設定に統合することもありません。
文書でこれらの機能を使う場合は、必要なコンポーネントを用意し、サーバーで描画した結果を確認してください。

**解析をカスタマイズする方法**

省略可能な第2引数は、Comark の `ParserOptions` を受け取ります。
`linkify` などの設定を変更したり、`plugins` 配列を渡して解析を拡張したりできます。
この配列は上記の4つのプラグインを置き換えるのではなく、その後に追加されます。
Effront が追加するプラグインを削除・置き換えするオプションはありません。
`registerDefaultPlugins: false` が無効にするのは、Comark 自体の既定プラグインだけです。
この契約以外の Comark の設定や構文については、[公式ドキュメント](https://comark.dev)を参照してください。

解析対象の Markdown と、使用するプラグインには信頼できるものだけを使ってください。
この parser は未信頼の投稿を安全な内容に変換する sanitizer ではありません。
解析中に発生した例外は `MarkdownError` になり、元の例外を `cause` に保持します。

## リンクとアセットの解決 {#references}

`parseMarkdown` は解析とプラグインの実行後に、`a.href` と `img.src` の文字列を解決します。
文書を解析せずに解決済み URL が必要な場合は、`entry.resolveLink(href)` または `entry.resolveImage(src)` を直接呼び出してください。
コレクション側には、同じ処理を行う `collection.resolveLink(entry, href)` と `collection.resolveImage(entry, src)` があります。
4つのメソッドはいずれも `Effect<string, MarkdownError>` を返し、相対パスの基準には Markdown ファイルのディレクトリを使います。

相対 `.md` リンクは `documents` に登録されたファイルを指す必要があり、その entry の公開 URL に解決されます。
相対アセットリンクや画像は `assets` に登録されたファイルを指す必要があり、読み込み済みの Vite URL に解決されます。
フラグメントだけの参照、`/` で始まるパス、外部 URL は変更せずに通します。
相対参照のクエリとフラグメントは保持されます。

たとえば、`basePath` が `/manual` で両方の文書が登録されていれば、`./guide/start.md` から `./details.md#example` へのリンクは `/manual/guide/details#example` に解決されます。
アセットの場合は、参照のクエリとフラグメントを読み込み済み URL の末尾にそのまま追加し、既存のクエリやフラグメントとは統合しません。
その URL にすでにクエリやフラグメントがある場合は、参照側で競合するものを付けずに使うか、完成した URL を直接指定してください。

解決できない相対参照やコレクションの基準ディレクトリ外への参照は、`parseMarkdown` 内で解決される場合も含め、`MarkdownError` になります。
これは `get` が返す `undefined` とは異なり、Effect のエラーチャネルにおける失敗です。
公開されている `MarkdownError` は、アプリケーションのエラー処理で使う `_tag: "MarkdownError"`、診断用の `message`、省略可能な元の `cause` を持ちます。
