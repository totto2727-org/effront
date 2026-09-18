## Layer はリクエストごとに構築する {#request-layer}

`EFFRONT.make({ routes, layer })` はルートグラフと Layer の定義を保持します。
`createFetchHandler` は factory の呼び出し時に Web ハンドラーを作り、リクエスト間で再利用します。
その内側の native HTTP Effect は評価ごとに新しい Layer の memo map を使うので、アプリケーションサービスの取得はリクエスト単位です。
ハンドラーの再利用は、サービスがサーバー全体で一度だけ取得されることを意味しません。
Node.js / Bun と Alchemy の native HTTP 接続も、このリクエスト単位の境界を使います。

Workers の `env`、execution context、元の `Request` は、そのリクエストの Effect context に提供されます。Layer の取得中も参照でき、別リクエストの値を共有 runtime 経由で読む構成にはなりません。バインディングの読み方は[Workers のリクエストコンテキスト](/platforms/cloudflare#context)を参照してください。

## レンダーを所有する Scope {#render-scope}

Server Function の Effect は HTTP リクエストの処理として実行します。 Flight レンダーでは親 Scope から子の render Scope を作り、`FiberSet.makeRuntimePromise` で Page、Layout、Component の Effect を実行します。 実行関数と有効な middleware は非同期ローカルなコンテキストに束縛されます。 これはリクエスト所有の scoped runtime であり、全リクエスト共通の実行サービスではありません。

対応するリクエスト runtime の外でレンダーした場合や、宣言した middleware が有効でない場合は`TypeError` になります。手動で Component のレンダー関数を起動するのではなく、 アプリケーションの Routes を通してレンダーしてください。

## Response を返した後も続く寿命 {#response-lifetime}

Fetch の Promise が Response に解決した時点では、Suspense の内容や Flight の送信が残っている可能性があります。 ハンドラーは Response body を包み、EOF、読み取りエラー、キャンセルのいずれかで取得済みサービスを解放します。 body がない場合はすぐに解放し、Response の生成自体が失敗した場合にも cleanup を実行します。 Flight の render Scope もストリームの終了や解放に合わせて閉じ、未完了のレンダー処理を中断します。

## アプリケーション側の設計 {#resource-design}

- リクエスト固有のリソースは Layer またはリクエスト Effect 内で取得し、`Effect.acquireRelease` などで解放処理を対応させます。

- レスポンス送信中に必要なリソースを、Response を得た直後の独自 cleanup で閉じないでください。 Fetch のラッパーを追加する場合も、body のストリーミングとキャンセルを引き継ぎます。

- リクエスト終了後の処理はホストが所有する寿命として明示的に設計します。 単に Promise を開始したり、リクエストのサービスを外側へ保存したりしても、寿命は延長されません。

- env は Flight や HTML に暗黙には追加されません。ただし自分で値を JSX、Client Component の props、 Server Function の戻り値に含めればブラウザーへ渡るため、秘密値を選別する責任はアプリケーション側にあります。
