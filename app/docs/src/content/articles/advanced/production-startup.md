## 起動はホスト統合が担当する {#host-boundary}

Effront は native Effect HTTP と互換用の Fetch ハンドラーを提供します。
リスナー、プロセスの signal、静的アセット、ホスト設定はアダプターとアプリケーションの起動エントリーが担当します。
`src/entry.effront.tsx` はホスト起動とは独立したアプリケーション定義です。

- [standalone Workers](../platforms/cloudflare.md): `entry.workers.ts` から Fetch を公開します。
- [Alchemy](../platforms/alchemy.md): native Worker の構築時にアプリケーションの HTTP Effect を接続します。
- [Node.js / Bun](../platforms/node-bun.md): `entry.rsc.ts` の native HTTP handler を `entry.server.ts` から起動します。

RSC と SSR とブラウザーのグラフを混ぜず、`react-server` 条件をプロセス全体へ指定しないでください。

## ビルドと起動の契約を分ける {#workers-artifact}

`vp build` はホストが実行できるコードとアセットを生成します。
ビルド成功はリスナーの起動やリモートへの公開を意味しません。
SSR モジュールとブラウザーアセットを含む成果物全体を配置し、変換前の RSC ソースをホストで再コンパイルしません。

| ホスト             | ビルド後のローカル起動                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| standalone Workers | `vp exec wrangler dev --local --no-bundle --config dist/rsc/wrangler.json` |
| Node.js            | `node dist/rsc/server.js`                                                  |
| Bun                | `bun dist/rsc/server.js`                                                   |

これらのローカル起動にはクラウドへのデプロイは不要です。
Alchemy CLI の profile と状態管理は別の前提なので、standalone Workers のコマンドを Alchemy アプリへそのまま流用しないでください。
アプリケーションの Layer はリクエストごとに取得し、レスポンスの終了・エラー・キャンセルまで生存させます。
ビルド時に永続サービスとして完成するものではありません。

## 起動後に確認すること {#startup-checks}

- 直接 URL を開き、SSR の HTML、スタイル、hydration を確認します。
- Flight 遷移、戻る・進む、非対応ブラウザーでのドキュメント移動を確認します。
- Server Function の戻り値と更新後の画面、JavaScript 無効時のフォーム送信を確認します。
- Suspense の遅延部分とキャンセル、秘密値が HTML や Flight に含まれないことを確認します。
- 静的ファイルの URL と 404 を確認します。Bun 固有 API は Bun の production entry で確認します。

開発サーバーだけでなく、利用するホストのビルド済み成果物でも [利用者の操作](../guide/testing.md) を試してください。
