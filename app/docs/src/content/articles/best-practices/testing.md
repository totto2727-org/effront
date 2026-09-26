実行中のアプリケーションに Playwright でアクセスし、Route、Page、Layout、Server Function の動作をテストします。
Effront は、Page / Layout の描画や Server Function のリクエストを Vitest で検証する公開テストハーネスを提供していません。

<span id="production"></span>

## 実行できるサンプルを使う {#tools}

以下のテストは [Basic サンプルアプリケーション](https://github.com/totto2727-org/effront/tree/main/examples/basic)を対象にしています。
[保守されている Playwright のテスト構成](https://github.com/totto2727-org/effront/tree/main/tests/e2e-alchemy)でサンプルをビルドし、Cloudflare の認証なしでローカルの workerd ホストを起動できます。
この構成はリポジトリー内の参照例であり、Effront に付属するテストヘルパーではありません。

[セットアップと実行の手順](https://github.com/totto2727-org/effront/blob/main/docs/TESTING.md#native-alchemy-integration)に従ってサンプルを実行してください。
以下のコードブロックを指定したファイル名でテストパッケージの `alchemy.e2e.ts` と同じディレクトリーに保存し、ブラウザーテストを再実行します。
既存の [Playwright 設定](https://github.com/totto2727-org/effront/blob/main/tests/e2e-alchemy/playwright.config.ts)が `baseURL` とサーバーの起動・終了を管理します。
自分のアプリケーションで使う場合は、URL、セレクター、期待値をアプリケーションの出力に合わせて変更してください。

## Route の応答をテストする {#routes}

サンプルは `EFFRONT.Routes.make().page(...)` で `/` と `/about` を登録しています。
HTTP リクエストで、登録したルートの応答と未登録ルートのステータスを確認します。
`routes.e2e.ts` として保存してください。

```ts
import { expect, test } from "@playwright/test";

test("registered routes return HTML and unknown routes return 404", async ({ request }) => {
  for (const path of ["/", "/about"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  }

  const missing = await request.get("/not-a-route");
  expect(missing.status()).toBe(404);
});
```

ビルドしたアプリケーションに対して、設定済みのミドルウェアを含むルートの応答を検証します。
登録内容はサンプルの[ルート定義](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/entry.effront.tsx)を参照してください。

## Page の出力とハイドレーションをテストする {#pages}

`HomePage` はアプリケーションの `Host` サービスから取得した挨拶と、クライアント側のカウンターを描画します。
`page.e2e.ts` として保存してください。

```ts
import { expect, test } from "@playwright/test";

test("HomePage renders service data and hydrates its counter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello, world!");
  await expect(page.getByTestId("kv-greeting")).toHaveText("Hello from Alchemy KV");

  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Count: 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toBeVisible();
});
```

挨拶の表示で、サーバー側で描画したデータを確認します。
カウンターの増加で、ハイドレーション後のクライアントコンポーネントを確認します。
この固定サンプルの[既存のテスト](https://github.com/totto2727-org/effront/blob/main/tests/e2e-alchemy/alchemy.e2e.ts)は、クライアント側の操作前に `networkidle` を待ちます。

## 画面遷移で Layout が維持されることをテストする {#layouts}

`RootLayout` は両方の Page を共通の [`Shell`](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/components/shell.tsx)で囲みます。
画面遷移で Page が切り替わっても、元のナビゲーション要素が DOM に接続されたままであることを検証します。
`layout.e2e.ts` として保存してください。

```ts
import { expect, test } from "@playwright/test";

test("RootLayout retains its navigation when the Page changes", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const navigation = await page.getByRole("navigation").elementHandle();
  if (!navigation) throw new Error("Expected the shared navigation");

  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("About");
  await expect(page.getByTestId("label")).toHaveText("Effront + Alchemy");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Home" })).toBeVisible();
  expect(await navigation.evaluate((element) => element.isConnected)).toBe(true);
});
```

元の DOM 要素を確認することで、同じ見た目のナビゲーションを作り直した場合も検出できます。
この維持のテストは、クライアントナビゲーションに使う Navigation API に対応した Chromium で実行してください。
ドキュメント全体のナビゲーションでは、Layout の DOM も置き換わります。

<span id="services"></span>

## クライアント経由で Server Function をテストする {#server-functions}

サンプルの [`GreetingAction`](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/features/greeting/client.tsx)は、Client Component から `greet("Ada")` を送信します。
[`greet` Server Function](https://github.com/totto2727-org/effront/blob/main/examples/basic/src/features/greeting/server.ts)はリクエストの `Host` サービスを読み、挨拶を返します。
`server-function.e2e.ts` として保存してください。

```ts
import { expect, test } from "@playwright/test";

test("the Server Function returns a greeting to its client", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const result = page.getByTestId("action-greeting");
  await expect(result).toHaveText("");

  await page.getByRole("button", { name: "Read KV through a Server Function" }).click();
  await expect(result).toHaveText("Hello from Alchemy KV, Ada!");
});
```

ボタン操作で、ブラウザーからのリクエスト、サーバー側の実行、戻り値の表示を検証します。
サーバー側の Vitest テストから Effront の Server Function を直接呼ぶと、`TypeError` で拒否されます。
このテストは読み取り処理を対象とし、永続化や認可は検証していません。
