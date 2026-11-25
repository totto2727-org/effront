import type { ReactNode } from "react";

import { coreRuntimeSources } from "./core-runtime-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <>
    <p>
      本文のストリーミングが続く場合、リクエストのサービスはレスポンス生成後も生存する必要があります。
      EffrontはアプリケーションのLayerをリクエストごとに取得し、応答本文の寿命の管理をホストのHTTP境界に委ねます。
      ホスト所有のサービスの参照を捕捉する処理は別であり、所有権を引き取ることも寿命を延ばすこともありません。
    </p>
    <p>
      <a href="/ja/architecture/implementation/application">アプリケーション定義</a> がLayerと{" "}
      <a href="/ja/architecture/implementation/routing">コンパイル済みルート</a> を供給します。
      <code>packages/core/src/http.ts</code> と <code>server/application.ts</code>{" "}
      が、これらを各リクエストに接続します。
    </p>
  </>
);

const renderFetchEntry = (): ReactNode => (
  <>
    <h2 id="fetch-entry">1. 現在のリクエスト用にサービスを取得する</h2>
    <p>
      <code>toHttpEffect(application)</code> は現在の <code>HttpServerRequest</code> を処理し、
      <code>HttpServerResponse</code> を返します。
      呼び出し側はリクエストのScopeと、アプリケーションLayerが要求する外部サービスを供給します。
      サービスを取得するのは、このEffectを作るときではなく実行するときです。
    </p>
    <SourceExcerpt source={coreRuntimeSources.requestHandler} />
    <p>
      新しい <code>Layer.CurrentMemoMap</code>{" "}
      によって、ホスト構築時にメモ化したアプリケーションのインスタンスの再利用を防ぎます。
      <code>HttpRouter.toHttpEffect</code> はアプリケーションのHTTP
      Layerを構築し、そのhandlerを現在のContextで直ちに実行します。
      Effectを再利用しても、Layerは評価ごとに取得します。
    </p>
    <p>
      取得前に、指定されたContent-Lengthが10
      MiB以下の安全な非負整数に変換できなければ413を返します。
      これはヘッダーの検査であり、ヘッダーがない場合の本文サイズの実測ではありません。
      <a href="/ja/architecture/implementation/server-functions">Server Functionのデコード</a>{" "}
      は、読み取るバイト数を別途制限します。
    </p>
    <p>
      <code>workers.ts</code> の <code>createFetchHandler</code> は、このEffectを{" "}
      <code>HttpEffect.toWebHandler</code> に渡します。 呼び出しごとに新しい{" "}
      <code>WorkersRequestContext</code> を追加しますが、リクエスト単位の取得は変えません。
    </p>
  </>
);

const renderRequestServices = (): ReactNode => (
  <>
    <h2 id="request-services">2. 取得したサービスをルートで使えるようにする</h2>
    <p>
      <code>ServerApplication.httpLayer</code> は、アプリケーションのLayer、
      <code>FlightRenderer.layer</code>、<code>HtmlRenderer.layer</code> を{" "}
      <code>RequestLayer</code> にまとめます。
      <code>Layer.build(RequestLayer)</code> が <code>applicationServices</code>{" "}
      のContextを生成します。 ルートの実行前に、<code>RequestContextMiddleware</code>{" "}
      がこれを実行中のHTTP Contextへ合流させます。
    </p>
    <p>
      <code>Services</code> はアプリケーションLayerの出力を表します。
      <code>Requirements</code> は構築や実行に必要な外部サービスを表し、HTTP Effectの型に残ります。
      ルーターを組み立てても、これらの外部要求は満たされません。
    </p>
    <p>
      GETルートはEffect HTTPのネイティブなdescriptorでPageのmiddlewareを合成します。
      POSTはReactの関数参照をデコードしてから、そのmiddlewareと描画先のrefreshに追加で必要なmiddlewareを適用します。
      どちらもリクエストで取得したサービスを使いますが、関数固有のmiddlewareはデコードで関数を特定するまで選べません。
    </p>
  </>
);

const renderResponseLifetime = (): ReactNode => (
  <>
    <h2 id="response-lifetime">3. レスポンス本文が終わるまでリソースを維持する</h2>
    <p>
      ストリーミングする <code>HttpServerResponse</code>{" "}
      は、ヘッダーの生成後もリクエストのScopeを必要とします。 Effect
      HTTPのWebハンドラーは、完了・失敗・キャンセルまでScopeを本文へ引き継ぎます。
      生成済みテキストなどの非ストリーム応答は、読み手を待たずに処理完了時にリソースを解放します。
    </p>
    <SourceExcerpt source={coreRuntimeSources.responseLifetime} />
    <p>
      HEADの本文は消費されません。Effect HTTPのWebハンドラーとネイティブなNode/Bunホストは、HEAD
      でもヘッダーを維持したままストリームを破棄し、リクエストのScopeを解放します。coreは応答をそのまま返します。
    </p>
    <p>
      HTTPに直接接続するホストも、同じ境界を保つ必要があります。 応答生成だけに{" "}
      <code>Effect.scoped</code> を適用すると、遅延した本文処理に必要なリソースを早く閉じすぎます。
      後からサービスを読む独自の本文は、必要なContextも捕捉しなければなりません。サービスを生かしておくだけでは、後のEffectに自動で提供されません。
    </p>
    <p>
      Flightの描画は、ストリーム完了に結び付いた子Scopeと解放処理を追加します。
      <a href="/ja/architecture/implementation/rendering">描画</a>{" "}
      は、この子Scopeと応答のライフサイクルの関係を説明します。
    </p>
  </>
);

const renderHostBoundary = (): ReactNode => (
  <>
    <h2 id="host-boundary">4. リクエストの状態を持ち越さずにホストのサービスを再利用する</h2>
    <p>
      <code>makeHttpEffect(application)</code> は外部サービスの参照を捕捉し、再利用可能なHTTP
      Effectを返します。
      構築時にアプリケーションのリクエストLayerを作ることも、参照の所有権を引き取ることもありません。
      所有者は、そのサービスを使うすべての応答本文が終わるまで維持する必要があります。
    </p>
    <SourceExcerpt source={coreRuntimeSources.externalContext} />
    <p>
      実行中のリクエストの値は、捕捉した値より優先されます。 合流前に{" "}
      <code>captureExternalContext</code>{" "}
      が構築時のScope、HTTPリクエスト、解析済み検索パラメーター、ルートContext、ルーター、Layerのmemo
      mapを除きます。
      <code>Effect.context&lt;R&gt;()</code>{" "}
      は型引数で実行時のキーを絞り込まないため、明示的に除く必要があります。
    </p>
    <p>
      <code>WorkersRequestContext</code> はreadonlyの <code>request</code>、<code>env</code>、
      <code>executionContext</code> を保持します。
      <code>createWorkersContextAccessors</code>{" "}
      が作るのは、その参照の型付き読み取り関数であり、新たなServiceやLayerではありません。
      型はホストの値を検証せず、参照がない状態で読むと <code>TypeError</code> になります。
    </p>
    <p>
      <code>@effront/cloudflare/workers</code> は読み取り関数を、
      <code>waitUntil(Promise&lt;unknown&gt;)</code> を含む <code>CloudflareExecutionContext</code>{" "}
      に具体化します。 ホストの値はEffect
      Contextにとどまり、FlightやHTMLへ暗黙にシリアライズされません。
      <a href="/ja/architecture/implementation/overview">アーキテクチャの全体図</a>{" "}
      は、このアダプター境界と描画・ブラウザーの入口の位置関係を示します。
    </p>
  </>
);

const renderRequest = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderFetchEntry()}
    {renderRequestServices()}
    {renderResponseLifetime()}
    {renderHostBoundary()}
  </>
);

export const requestPage = {
  content: renderRequest,
  description:
    "リクエスト処理でアプリケーションサービスを取得・共有・解放する仕組みを読み解きます。",
  group: "実装解説",
  headings: [
    { id: "fetch-entry", title: "1. 現在のリクエスト用にサービスを取得する" },
    { id: "request-services", title: "2. 取得したサービスをルートで使えるようにする" },
    { id: "response-lifetime", title: "3. レスポンス本文が終わるまでリソースを維持する" },
    {
      id: "host-boundary",
      title: "4. リクエストの状態を持ち越さずにホストのサービスを再利用する",
    },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/request",
  title: "04. リクエストのサービスとその寿命",
} satisfies DocPage;
