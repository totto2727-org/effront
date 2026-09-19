## Layer はリクエストごとに構築する {#request-layer}

`EFFRONT.make({ routes, layer })` に渡したアプリケーションの Layer は、リクエストごとに取得します。
`createFetchHandler` でハンドラーを作り、リクエスト間で再利用できます。
ハンドラーの再利用は、サービスがサーバー全体で一度だけ取得されることを意味しません。
Node.js / Bun と Alchemy の native HTTP 接続も、このリクエスト単位の境界を使います。

Workers の `env`、execution context、元の `Request` は、処理中のリクエストの値を Layer の取得中も参照できます。
バインディングの読み方は[Workers のリクエストコンテキスト](/platforms/cloudflare#context)を参照してください。

## レンダーを所有する Scope {#render-scope}

Server Function と Page、Layout、Component の Effect は、リクエストの Scope のもとでアプリケーションのサービスを使って実行します。
レンダーの Scope はリクエストを越えて共有されず、レンダーが終了または中断すると閉じます。

対応するリクエスト runtime の外でレンダーした場合や、宣言した middleware が有効でない場合は`TypeError` になります。手動で Component のレンダー関数を起動するのではなく、 アプリケーションの Routes を通してレンダーしてください。

## Response を返した後も続く寿命 {#response-lifetime}

Fetch の Promise が Response に解決した時点では、Suspense の内容や Flight の送信が残っている可能性があります。
リクエストで取得したサービスは、レスポンス本文の読み取りが完了、失敗、キャンセルするまで保持されます。
本文がない場合はすぐに解放し、Response の生成自体が失敗した場合にも解放します。
レンダーのストリームを中断した場合は、未完了のレンダー処理も中断します。

## アプリケーション側の設計 {#resource-design}

- リクエスト固有のリソースは Layer またはリクエスト Effect 内で取得し、`Effect.acquireRelease` などで解放処理を対応させます。

- レスポンス送信中に必要なリソースを、Response を得た直後の独自 cleanup で閉じないでください。 Fetch のラッパーを追加する場合も、body のストリーミングとキャンセルを引き継ぎます。

- リクエスト終了後の処理はホストが所有する寿命として明示的に設計します。 単に Promise を開始したり、リクエストのサービスを外側へ保存したりしても、寿命は延長されません。

- env は Flight や HTML に暗黙には追加されません。ただし自分で値を JSX、Client Component の props、 Server Function の戻り値に含めればブラウザーへ渡るため、秘密値を選別する責任はアプリケーション側にあります。
