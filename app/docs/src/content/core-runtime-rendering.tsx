import type { ReactNode } from "react";

import { renderArticleList } from "./core-article-list.tsx";
import { coreRuntimeSources } from "./core-runtime-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    ドキュメントのリクエストとクライアント遷移は、一つのPage描画経路を共有します。
    どちらもReactのFlightストリームから始まります。遷移では直接読み取り、SSRではHTMLにデコードしてhydration用のコピーを埋め込みます。
  </p>
);

const renderSsrBranchList = (): ReactNode =>
  renderArticleList("ul", [
    {
      content: (
        <>
          <strong>SSR：</strong>
          <code>@vitejs/plugin-rsc/ssr</code> がペイロードをデコードし、
          <code>react-dom/server.edge</code> がその <code>RouteTree</code> をHTMLへ描画します。
        </>
      ),
      id: "ssr",
    },
    {
      content: (
        <>
          <strong>ブラウザー：</strong>hydration用のFlightバイト列をHTMLへ埋め込みます。
        </>
      ),
      id: "browser",
    },
  ]);

const renderSsrBranch = (): ReactNode => (
  <>
    <h2 id="ssr-branch">一つの描画から二つのレスポンス形式を返す</h2>
    <p>
      ルーティングと <a href="/ja/architecture/implementation/request">リクエストのサービス取得</a>{" "}
      の後、
      <code>packages/core/src/server/application.ts</code> の <code>render</code> が{" "}
      <code>FlightRenderer</code> を呼びます。 Acceptが <code>text/x-component</code>{" "}
      と完全に一致する場合だけFlightを返します。
      それ以外は、このメディアタイプを含むAcceptの候補リストも含めてHTMLを選びます。
    </p>
    <p>
      <code>HtmlRenderer</code> は{" "}
      <code>import.meta.viteRsc.loadModule(&quot;ssr&quot;, &quot;index&quot;)</code>{" "}
      でSSR環境を読み込みます。
      <code>server/ssr.tsx</code> では、<code>tee()</code> がFlightを二つに分けます。
    </p>
    {renderSsrBranchList()}
    <p>
      SSRはRSCの結果を読み取り、Pageのサーバー描画Effectを再実行しません。
      フォーム状態、リクエストのScopeに属するabort signal、クライアントエントリをimportするbootstrap
      scriptも受け取ります。 どちらの形式も <code>Cache-Control: private, no-store</code>{" "}
      を使います。 GETとPOSTのpre-response handlerは既存のVaryフィールドを保持し、Acceptまたは{" "}
      <code>*</code> がなければAcceptを加えます。
    </p>
  </>
);

const renderRouteToFlight = (): ReactNode => (
  <>
    <h2 id="route-to-flight">共通のFlightペイロードを組み立てる</h2>
    <p>
      <code>rsc/render-route-tree.tsx</code> の <code>renderRouteTree</code>{" "}
      は、一致したPageから描画先のスコープを内側から外側へたどり、Loading境界とLayoutを加えます。
      生成するのはHTMLではなく、<code>id</code>、<code>content</code>、<code>child</code> を持つ{" "}
      <code>RouteTreeModel</code> です。
      LayoutのIDはスコープのidentityを使い、PageとLoadingのIDにはpathnameも含めます。
    </p>
    <p>
      非POSTリクエストでは、PageのパラメーターSchemaがツリー構築前に{" "}
      <a href="/ja/architecture/implementation/routing">ルートパラメーター</a> をデコードします。
      失敗するとFlight描画を始めずに本文なしの404を返します。
      POSTは代わりにエンコード済みパラメーターをPageへ渡すため、事前検証はすべてのリクエストには適用されません。
    </p>
    <p>
      <code>rsc/flight.ts</code> の <code>FlightPayload</code> は、<code>routeTree</code>、
      <code>formState</code>、<code>serverFnResult</code> を含みます。
      <code>FlightRenderer</code> はこれを <code>@vitejs/plugin-rsc/rsc/server</code> の{" "}
      <code>renderToReadableStream</code> へ渡し、一時参照があればオプションとして渡します。
      ペイロードが運ぶのは描画データとactionの状態であり、サービスContextの自動的なコピーではありません。
    </p>
  </>
);

const renderRenderRuntime = (): ReactNode => (
  <>
    <h2 id="render-runtime">非同期の描画をリクエストの中で実行する</h2>
    <p>
      ReactはReadableStreamを返した後も、Page、Layout、ComponentのEffectを呼ぶことがあります。
      <code>FlightRenderer</code> はこの処理に子Scopeを与え、ストリームとabort
      signalに加えて解放処理を返します。
    </p>
    <SourceExcerpt source={coreRuntimeSources.flightRuntime} />
    <p>
      <code>FiberSet.makeRuntimePromise</code> がPromiseベースのEffect実行関数を供給し、Fiberは{" "}
      <code>renderScope</code> に属します。
      <code>application/render-runtime.ts</code> の <code>renderRuntime.bind</code>{" "}
      が、その実行関数と有効なmiddlewareをAsyncLocalStorageへ保持します。 定義の <code>run</code>{" "}
      は、この束縛と宣言済みのすべてのmiddlewareスコープを要求します。 どちらかが欠ければ{" "}
      <code>TypeError</code> になり、
      <a href="/ja/architecture/implementation/application">定義のサービスとスコープの契約</a>{" "}
      を実行時に検査します。
    </p>
    <p>
      <code>server/application.ts</code> は両方の応答形式に{" "}
      <code>Stream.ensuring(flight.release)</code> を付け、HTML開始時の失敗でもFlightを解放します。
      Flight開始時の失敗も子Scopeを閉じます。
      Reactのエラーは、signalがabortされていなければ実行関数を通して記録します。
      HTMLの読み込みや開始時の失敗は <code>HtmlRenderError</code>{" "}
      になり、その後の失敗は応答本文を通して伝わります。
    </p>
  </>
);

const renderHtmlEof = (): ReactNode => (
  <>
    <h2 id="html-eof">HTMLストリームを壊さずにFlightを届ける</h2>
    <p>
      HTMLチャンクはタグなどの構文の途中で終わることがあり、任意のチャンク境界へFlightのscriptを挿入するとドキュメントを壊すおそれがあります。
      <code>server/flight-html-stream.ts</code> は代わりにHTMLのEOFを待ちます。
    </p>
    <SourceExcerpt source={coreRuntimeSources.htmlEof} />
    <p>
      <code>makeHtmlWriter</code> は末尾の <code>{"</body></html>"}</code>{" "}
      候補を保留しながらマークアップを転送します。
      EOFではFlightのscriptを書き、その後に閉じタグを書きます。
      SSRがFlightを読み続けるためHTMLはストリーミングできますが、ブラウザー側の分岐は挿入までキューにたまります。
      埋め込みFlightがHTMLの各チャンクとともに逐次届くわけではありません。
    </p>
    <p>
      各FlightチャンクはfatalなUTF-8 decoderで独立にデコードします。
      不正または不完全なUTF-8はbase64へ切り替え、ブラウザーで <code>Uint8Array</code> を復元します。
      inline scriptは <code>{"</script"}</code> と <code>{"<!--"}</code> をescapeします。
      <code>client/initial-flight-stream.ts</code> は <code>self.__FLIGHT_DATA</code>{" "}
      の文字列をバイト列へ戻し、バイト配列はそのまま転送します。
      DOMContentLoaded時、またはドキュメントの準備が済んでいれば直ちに閉じ、
      <a href="/ja/architecture/implementation/navigation">hydration</a>{" "}
      用のストリームを供給します。
    </p>
    <p>
      キャンセルでは先にFlight readerをキャンセルしてlockを解放し、次にHTML
      readerをキャンセルします。
      Flightのtee分岐のキャンセルPromiseはawaitしません。もう一方の分岐を待つことがあり、その分岐もリクエストのabort
      signalを必要とする可能性があるためです。 読み取りとflushのエラーはstream controllerに伝え、
      <a href="/ja/architecture/implementation/request#response-lifetime">応答本文の所有者</a>{" "}
      が後始末を完了できるようにします。
    </p>
  </>
);

const renderRendering = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderSsrBranch()}
    {renderRouteToFlight()}
    {renderRenderRuntime()}
    {renderHtmlEof()}
  </>
);

export const renderingPage = {
  content: renderRendering,
  description:
    "アプリケーションから HTML と React Server Components のデータを生成する描画処理を読み解きます。",
  group: "実装解説",
  headings: [
    { id: "ssr-branch", title: "一つの描画から二つのレスポンス形式を返す" },
    { id: "route-to-flight", title: "共通のFlightペイロードを組み立てる" },
    { id: "render-runtime", title: "非同期の描画をリクエストの中で実行する" },
    { id: "html-eof", title: "HTMLストリームを壊さずにFlightを届ける" },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/rendering",
  title: "05. ルートからHTMLとFlightへ",
} satisfies DocPage;
