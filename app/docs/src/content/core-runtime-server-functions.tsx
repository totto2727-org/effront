import type { ReactNode } from "react";

import { renderArticleList } from "./core-article-list.tsx";
import { coreRuntimeSources } from "./core-runtime-sources.ts";
import { SourceExcerpt } from "./core-source.tsx";
import type { DocPage } from "./types.ts";

const renderIntroduction = (): ReactNode => (
  <p>
    ブラウザーからの Server Function 呼び出しに対する正しい Flight
    レスポンスは、呼び出し結果と更新されたルートツリーを含みます。 そのため、関数の失敗がHTTP
    200で届くことがあります。一方、成功しても古くなった応答で、ユーザーが離れたページを復元してはいけません。
    アプリケーションでの利用方法は{" "}
    <a href="/ja/advanced/server-function-execution-and-refresh">実行と画面更新のガイド</a>{" "}
    を参照してください。
  </p>
);

const renderRequestDecoding = (): ReactNode => (
  <>
    <h2 id="request-decoding">1. 届いた呼び出しを識別して検証する</h2>
    <p>
      <code>client/call-server.ts</code>{" "}
      は現在の履歴entryまたはURLと、増加する呼び出し順序を記録します。 Reactの{" "}
      <code>encodeReply</code> で引数をエンコードし、<code>FlightClient</code>{" "}
      でそのURLへPOSTします。<code>x-effront-server-fn</code> を送り、Flightを要求します。
      描画先のPOST handlerが <code>prepareServerFnRequest</code> を呼びます。
    </p>
    <p>
      デコード前に <code>validateOrigin</code> が、解析したOrigin
      URLのhostと、小文字化したHostヘッダーを比べます。 ヘッダーの欠落、不正なOrigin
      URL、不一致は403になります。
      比較するのはhostであり、schemeやorigin全体ではありません。処理の認証や認可も行いません。
      リクエストは、リクエストScopeのAbortSignalを使ってWeb Requestになります。 action
      IDのヘッダーがあればクライアント呼び出し、なければJavaScriptなしでも使えるprogressive
      formの経路を選びます。
    </p>
    <p>
      どちらの経路も実際に読んだバイト数を数え、10 MiBを超える本文を400で拒否します。
      <a href="/ja/architecture/implementation/request">HTTP入口のContent-Length検査</a>{" "}
      は別であり、読み取り前に413を返すことがあります。
      バッファーに読み込んだmultipart本文はFormData、それ以外はtextになります。
      読み取りとmultipart解析の失敗は400です。
    </p>
    <SourceExcerpt source={coreRuntimeSources.serverFnDecode} />
    <p>
      <code>decodeReply</code> は配列サイズ上限10,000と一時参照を使って引数を復元します。
      Effrontは結果が配列であることを確認し、<code>loadServerAction</code> が関数を解決します。
      デコード、配列形式、参照解決の失敗は、アプリケーション入力の検証前に400になります。
      サーバーは一時参照をFlightへ引き継ぎ、ブラウザーは <code>encodeReply</code>{" "}
      に渡した集合でデコードします。
    </p>
  </>
);

const renderFunctionDefinition = (): ReactNode => (
  <>
    <h2 id="function-definition">2. Reactの参照から型付きの実行処理を取り出す</h2>
    <p>
      <code>makeServerFnFactory</code> で作ったServer
      Functionを呼ぶと、handlerを直ちに実行せず、Effectを記述するbrand付きPromiseを返します。
      これにより、HTTP処理は実行前にアプリケーションidentityとmiddlewareを取り出せます。
    </p>
    <SourceExcerpt source={coreRuntimeSources.serverFnSchema} />
    <p>
      呼び出し側はSchemaの <code>Encoded</code> 値を渡し、handlerは <code>Schema.Tuple</code>{" "}
      成功後にデコード済みの <code>Type</code> 値を受け取ります。
      単一Schemaは最初の引数をデコードし、余分なネイティブ引数は無視し、省略時はundefinedをデコードします。
      Schema配列は位置付きの引数列を検証し、入力を省略した関数は空の引数列を要求します。
      デコードとhandlerは <code>AvailableServices</code> を要求でき、その型付き失敗は{" "}
      <code>ServerFnOperationError</code> になります。
    </p>
    <SourceExcerpt source={coreRuntimeSources.serverFnBrand} />
    <p>
      返されるPromiseには、Effect、identity、middlewareを持つbrandが付きます。
      サーバーグラフで直接awaitすると <code>TypeError</code> でrejectします。 HTTPでは代わりに{" "}
      <code>matchServerFnInvocation</code> が処理を取り出し、
      <a href="/ja/architecture/implementation/application">アプリケーションidentity</a>{" "}
      を検査します。 別のEFFRONT identityは拒否します。 brandのないネイティブReact Server
      Functionは別経路を通り、Effrontの関数middlewareを使わずEffect内で結果を待ちます。
    </p>
  </>
);

const renderExecutionOutcome = (): ReactNode => (
  <>
    <h2 id="execution-outcome">3. Middleware内で実行し結果を描画に渡す</h2>
    <p>
      <code>PreparedServerFnRequest</code> は <code>execute</code> と関数のmiddlewareを含みます。
      <code>server/application.ts</code> の <code>executeServerFnAndRefresh</code>{" "}
      が、実行と描画をそのmiddlewareで包みます。
      描画先だけが必要とするmiddlewareは、関数に適用済みのものを除いて描画を包みます。
      レンダラーは実行時スコープの検査用に、両方をまとめた一覧を受け取ります。
    </p>
    <p>
      クライアント呼び出しでは、<code>serverFnOutcome</code> が処理のExitを{" "}
      <code>serverFnResult</code> のSuccessまたはFailureへ変換します。 どちらもstatus
      200で描画するため、HTTPの成功だけでは関数の成功を示しません。
      割り込みはFailureのデータにせず、割り込みのまま保ちます。
      <a href="/ja/architecture/implementation/rendering">Flightペイロード</a>{" "}
      が結果とルートツリーの両方を運びます。
    </p>
    <p>
      progressive formはmultipartのFormDataとReactの <code>decodeAction</code> を必要とします。
      actionの欠落やデコード失敗は400です。 実行後、<code>decodeFormState</code>{" "}
      がSSRとhydrationに状態を供給します。 成功時は <code>formState</code> と{" "}
      <code>serverFnResult: null</code> をstatus
      200で描画し、通常のドキュメントフォーム要求にはHTMLを返します。
      型付きの実行失敗とフォーム状態のデコード失敗は500です。 POSTルートは{" "}
      <code>ServerFnRequestError</code>{" "}
      を、関数結果のペイロードではなく、指定statusとテキスト応答へ変換します。
    </p>
  </>
);

const renderResultRefreshList = (): ReactNode =>
  renderArticleList("ul", [
    { content: "最後に開始した呼び出しの応答である。", id: "latest-invocation" },
    { content: "ナビゲーションのTransitionが進行中でない。", id: "navigation-idle" },
    {
      content: (
        <>
          現在の履歴entryが記録したIDと一致する。または、どちらにもentryがなくURLが変わっていない。
        </>
      ),
      id: "same-history-entry",
    },
  ]);

const renderResultRefresh = (): ReactNode => (
  <>
    <h2 id="result-refresh">4. 呼び出し結果を確定してから画面の更新方法を選ぶ</h2>
    <p>
      非2xx、Flight以外、結果の欠落は、結果に基づくrefreshを行わずにブラウザーの呼び出しをrejectします。
      有効なSuccessは呼び出し元のPromiseをresolveし、有効なFailureは <code>ServerFnCallError</code>{" "}
      でrejectします。 Effrontは確定後に継続処理を登録し、Reactの既存Actionの処理がrefresh
      Transitionより先に実行されるようにします。
      両方の結果が同じrefresh判定を使うため、関数の失敗はUIを変更しないことを意味しません。
    </p>
    <p>返されたツリーを再利用できるのは、次の条件を満たす場合だけです。</p>
    {renderResultRefreshList()}
    <p>
      古いrefreshの割り込み後も、Effrontは再検査します。後始末の間に別の呼び出しや遷移が先へ進む可能性があるためです。
      適さない応答は解放し、
      <code>RouteRefresher.refreshCurrentRoute(&quot;server-function&quot;)</code>{" "}
      が代わりに現在の描画先を更新します。
      この経路は遷移が落ち着くのを待ち、refreshを新しいルート遷移と競合させます。
    </p>
    <p>
      再利用できる応答では、<code>RouteLoader.prepareRefresh</code> がキャッシュを無効化し、
      <code>startTransition</code> がtype <code>server-function</code> でツリーを公開します。
      Transition Actionはcommit Promiseを返しません。返すと、待機対象のcommitを妨げるためです。
      別のスコープ付きFiberが応答完了とReactのcommitを待ってキャッシュし、先に公開が退役したら待機をやめます。
      どちらの場合も後始末で応答を解放します。 これは{" "}
      <a href="/ja/architecture/implementation/overview">リクエストからブラウザーへの流れ</a>{" "}
      の中で、<a href="/ja/architecture/implementation/navigation">ナビゲーション</a>{" "}
      と同じ所有権の境界を共有します。
    </p>
  </>
);

const renderServerFunctions = (): ReactNode => (
  <>
    {renderIntroduction()}
    {renderRequestDecoding()}
    {renderFunctionDefinition()}
    {renderExecutionOutcome()}
    {renderResultRefresh()}
  </>
);

export const serverFunctionsPage = {
  content: renderServerFunctions,
  description: "Server Function の呼び出しからサーバー側の処理、画面更新までの実装を読み解きます。",
  group: "実装解説",
  headings: [
    { id: "request-decoding", title: "1. 届いた呼び出しを識別して検証する" },
    { id: "function-definition", title: "2. Reactの参照から型付きの実行処理を取り出す" },
    { id: "execution-outcome", title: "3. Middleware内で実行し結果を描画に渡す" },
    { id: "result-refresh", title: "4. 呼び出し結果を確定してから画面の更新方法を選ぶ" },
  ],
  section: "アーキテクチャ",
  slug: "/architecture/implementation/server-functions",
  title: "07. Server Functionの呼び出しから画面更新まで",
} satisfies DocPage;
