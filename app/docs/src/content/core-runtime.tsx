import { SourceExcerpt, type CoreSource } from "./core-source";
import type { DocPage } from "./types";

export const coreRuntimeSources = {
  requestHandler: {
    path: "packages/core/src/http.ts",
    language: "typescript",
    code: `export const toHttpEffect = <Services, ApplicationError, Requirements>(
  application: ApplicationDefinition<Services, ApplicationError, Requirements>,
): HttpApplicationEffect<ApplicationError, Requirements> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const length = request.headers["content-length"];
    if (length !== undefined) {
      const size = Number(length);
      if (!Number.isSafeInteger(size) || size < 0 || size > maxRequestBodySize) {
        return HttpServerResponse.text("Request body exceeds the 10 MiB limit.", { status: 413 });
      }
    }
    // Request layers must not reuse instances from a host's construction memo map.
    const memoMap = yield* Layer.makeMemoMap;
    const handler = yield* HttpRouter.toHttpEffect(ServerApplication.httpLayer(application)).pipe(
      Effect.provideService(Layer.CurrentMemoMap, memoMap),
    );
    const response = yield* handler;`,
  },
  responseLifetime: {
    path: "packages/core/src/http.ts",
    language: "typescript",
    code: `    // Effect rc.112 transfers every streaming response scope before discarding
    // HEAD bodies. Preserve GET metadata but prevent transfer to an unread body.
    return request.method === "HEAD"
      ? HttpServerResponse.setBody(response, HttpBody.empty).pipe(
          HttpServerResponse.setHeaders(response.headers),
        )
      : response;
  });`,
  },
  externalContext: {
    path: "packages/core/src/http.ts",
    language: "typescript",
    code: `  const handler = toHttpEffect(application);
  return Effect.map(Effect.context<CapturedRequirements<Requirements>>(), (context) => {
    const captured: Context.Context<CapturedRequirements<Requirements>> =
      captureExternalContext<HttpRequirements<Requirements>>(context);
    return Effect.contextWith(
      (requestContext: Context.Context<RemainingRequirements<Requirements>>) => {
        const provided: Context.Context<CapturedRequirements<Requirements>> = Context.merge(
          captured,
          requestContext,
        );
        return Effect.provideContext(handler, provided);
      },
    );
  });`,
  },
  flightRuntime: {
    path: "packages/core/src/server/flight-renderer.tsx",
    language: "tsx",
    code: `        const errorDigest = yield* nextErrorDigest;
        const parentScope = yield* Effect.scope;
        const renderScope = yield* Scope.fork(parentScope);
        const release = Scope.close(renderScope, Exit.void);
        return yield* Effect.gen(function* () {
          const runtime = yield* FiberSet.makeRuntimePromise<Services>().pipe(
            Scope.provide(renderScope),
          );
          const signal = yield* Effect.abortSignal.pipe(Scope.provide(renderScope));
          const { renderToReadableStream } = yield* Effect.promise(
            () => import("@vitejs/plugin-rsc/rsc/server"),
          );
          const stream = renderRuntime.bind(runtime, middleware, () => {
            const payload = { formState, routeTree, serverFnResult } satisfies FlightPayload;
            return renderToReadableStream(payload, {
              onError: (error: unknown) => {
                if (!signal.aborted) {
                  void runtime(
                    Effect.logError(error).pipe(Effect.annotateLogs("errorDigest", errorDigest)),
                  );
                }
                return errorDigest;
              },
              signal,
              temporaryReferences,
            });
          });
          return { release, signal, stream } satisfies FlightRender;
        }).pipe(Effect.onError(() => release));`,
  },
  htmlEof: {
    path: "packages/core/src/server/flight-html-stream.ts",
    language: "typescript",
    code: `  const transform = new TransformStream<Uint8Array, Uint8Array>({
    async flush(controller) {
      try {
        htmlWriter.finish(controller);
        // HTML chunks are arbitrary bytes, not parser boundaries. Only HTML EOF is
        // safe for injection without a tokenizer. The SSR tee branch keeps pulling
        // Flight while its browser branch queues, so HTML still streams normally.
        await writeFlightStream(flightReader, controller, options?.nonce);
        controller.enqueue(htmlTrailer);
      } catch (cause) {
        controller.error(cause);
      } finally {
        releaseFlight();
      }
    },
    transform(chunk, controller) {
      htmlWriter.write(chunk, controller);
    },
  });`,
  },
  navigationEligibility: {
    path: "packages/core/src/client/navigation-routing.ts",
    language: "typescript",
    code: `const ReactTransitionNavigationInfo = "react-transition";

export const NativeDocumentNavigationInfo = "effront-native-document";

export const isRoutedNavigation = (event: NavigateEvent) =>
  event.canIntercept &&
  !event.hashChange &&
  event.downloadRequest === null &&
  event.formData === null &&
  event.info !== ReactTransitionNavigationInfo &&
  event.info !== NativeDocumentNavigationInfo &&
  event.navigationType !== "reload";`,
  },
  navigationPublication: {
    path: "packages/core/src/client/client-router.ts",
    language: "typescript",
    code: `          const rendererNavigation = yield* Effect.sync(() => {
            let navigation!: BrowserRendererNavigation;
            startTransition(() => {
              const fromIndex =
                navigationApi.getTransition()?.from.index ??
                navigationApi.getCurrentEntry()?.index ??
                null;
              for (const type of getNavigationTransitionTypes(event, fromIndex)) {
                addTransitionType(type);
              }
              for (const type of linkTransitionTypes) {
                addTransitionType(type);
              }
              navigation = browserRenderer.navigate(command.resource.routeTree);
            });
            return navigation;
          });`,
  },
  serverFnSchema: {
    path: "packages/core/src/application/server-fn.ts",
    language: "typescript",
    code: `    const schemas = Array.ensure<Schema.ConstraintDecoder<unknown, AvailableServices>>(input);
    const decode = Schema.decodeUnknownEffect(Schema.Tuple(schemas));`,
  },
  serverFnBrand: {
    path: "packages/core/src/application/server-fn.ts",
    language: "typescript",
    code: `      const unavailable =
        Promise.reject<ServerFnWireValue<Effect.Success<typeof effect>>>(directInvocationError());
      void unavailable.catch(() => undefined);

      return Object.assign(unavailable, {
        [ServerFnInvocationTypeId]: Object.freeze({ effect, identity, middleware }),
      });`,
  },
  serverFnDecode: {
    path: "packages/core/src/server/server-fn-request.ts",
    language: "typescript",
    code: `  const temporaryReferences = createTemporaryReferenceSet();
  const body = yield* readBody(request);
  const decoded = yield* Effect.tryPromise({
    try: () =>
      decodeReply(body, {
        arraySizeLimit: ServerFnArraySizeLimit,
        temporaryReferences,
      }),
    catch: (cause) => requestError("Failed to decode Server Function arguments.", 400, cause),
  });
  const args = yield* decodeArguments(decoded).pipe(
    Effect.mapError((cause) =>
      requestError("Expected a Server Function argument array.", 400, cause),
    ),
  );
  const action = yield* Effect.tryPromise({
    try: () => loadServerAction(actionId),
    catch: (cause) => requestError("The requested Server Function does not exist.", 400, cause),
  });`,
  },
} satisfies Record<string, CoreSource>;

export const coreRuntimePages: readonly DocPage[] = [
  {
    slug: "/architecture/implementation/request",
    title: "04. リクエストのサービスとその寿命",
    description:
      "リクエスト処理でアプリケーションサービスを取得・共有・解放する仕組みを読み解きます。",
    section: "アーキテクチャ",
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
    content: () => (
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
          <a href="/ja/architecture/implementation/server-functions">
            Server Functionのデコード
          </a>{" "}
          は、読み取るバイト数を別途制限します。
        </p>
        <p>
          <code>workers.ts</code> の <code>createFetchHandler</code> は、このEffectを{" "}
          <code>HttpEffect.toWebHandler</code> に渡します。 呼び出しごとに新しい{" "}
          <code>WorkersRequestContext</code> を追加しますが、リクエスト単位の取得は変えません。
        </p>
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
          <code>Requirements</code> は構築や実行に必要な外部サービスを表し、HTTP
          Effectの型に残ります。 ルーターを組み立てても、これらの外部要求は満たされません。
        </p>
        <p>
          GETルートはEffect HTTPのネイティブなdescriptorでPageのmiddlewareを合成します。
          POSTはReactの関数参照をデコードしてから、そのmiddlewareと描画先のrefreshに追加で必要なmiddlewareを適用します。
          どちらもリクエストで取得したサービスを使いますが、関数固有のmiddlewareはデコードで関数を特定するまで選べません。
        </p>
        <h2 id="response-lifetime">3. レスポンス本文が終わるまでリソースを維持する</h2>
        <p>
          ストリーミングする <code>HttpServerResponse</code>{" "}
          は、ヘッダーの生成後もリクエストのScopeを必要とします。 Effect
          HTTPのWebハンドラーは、完了・失敗・キャンセルまでScopeを本文へ引き継ぎます。
          生成済みテキストなどの非ストリーム応答は、読み手を待たずに処理完了時にリソースを解放します。
        </p>
        <SourceExcerpt source={coreRuntimeSources.responseLifetime} />
        <p>
          HEADの本文は消費されません。 固定しているEffect
          rc.112は、HEADの本文を破棄する前にストリーミング応答のScopeを移譲します。
          Effrontは先に本文を <code>HttpBody.empty</code>{" "}
          に置き換え、ヘッダーを維持することで、読まれないストリームへの移譲を防ぎます。
        </p>
        <p>
          HTTPに直接接続するホストも、同じ境界を保つ必要があります。 応答生成だけに{" "}
          <code>Effect.scoped</code>{" "}
          を適用すると、遅延した本文処理に必要なリソースを早く閉じすぎます。
          後からサービスを読む独自の本文は、必要なContextも捕捉しなければなりません。サービスを生かしておくだけでは、後のEffectに自動で提供されません。
        </p>
        <p>
          Flightの描画は、ストリーム完了に結び付いた子Scopeと解放処理を追加します。
          <a href="/ja/architecture/implementation/rendering">描画</a>{" "}
          は、この子Scopeと応答のライフサイクルの関係を説明します。
        </p>
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
          <code>waitUntil(Promise&lt;unknown&gt;)</code> を含む{" "}
          <code>CloudflareExecutionContext</code> に具体化します。 ホストの値はEffect
          Contextにとどまり、FlightやHTMLへ暗黙にシリアライズされません。
          <a href="/ja/architecture/implementation/overview">アーキテクチャの全体図</a>{" "}
          は、このアダプター境界と描画・ブラウザーの入口の位置関係を示します。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/rendering",
    title: "05. ルートからHTMLとFlightへ",
    description:
      "アプリケーションから HTML と React Server Components のデータを生成する描画処理を読み解きます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "ssr-branch", title: "一つの描画から二つのレスポンス形式を返す" },
      { id: "route-to-flight", title: "共通のFlightペイロードを組み立てる" },
      { id: "render-runtime", title: "非同期の描画をリクエストの中で実行する" },
      { id: "html-eof", title: "HTMLストリームを壊さずにFlightを届ける" },
    ],
    content: () => (
      <>
        <p>
          ドキュメントのリクエストとクライアント遷移は、一つのPage描画経路を共有します。
          どちらもReactのFlightストリームから始まります。遷移では直接読み取り、SSRではHTMLにデコードしてhydration用のコピーを埋め込みます。
        </p>
        <h2 id="ssr-branch">一つの描画から二つのレスポンス形式を返す</h2>
        <p>
          ルーティングと{" "}
          <a href="/ja/architecture/implementation/request">リクエストのサービス取得</a> の後、
          <code>packages/core/src/server/application.ts</code> の <code>render</code> が{" "}
          <code>FlightRenderer</code> を呼びます。 Acceptが <code>text/x-component</code>{" "}
          と完全に一致する場合だけFlightを返します。
          それ以外は、このメディアタイプを含むAcceptの候補リストも含めてHTMLを選びます。
        </p>
        <p>
          <code>HtmlRenderer</code> は <code>import.meta.viteRsc.loadModule("ssr", "index")</code>{" "}
          でSSR環境を読み込みます。
          <code>server/ssr.tsx</code> では、<code>tee()</code> がFlightを二つに分けます。
        </p>
        <ul>
          <li>
            <strong>SSR：</strong>
            <code>@vitejs/plugin-rsc/ssr</code> がペイロードをデコードし、
            <code>react-dom/server.edge</code> がその <code>RouteTree</code> をHTMLへ描画します。
          </li>
          <li>
            <strong>ブラウザー：</strong>hydration用のFlightバイト列をHTMLへ埋め込みます。
          </li>
        </ul>
        <p>
          SSRはRSCの結果を読み取り、Pageのサーバー描画Effectを再実行しません。
          フォーム状態、リクエストのScopeに属するabort
          signal、クライアントエントリをimportするbootstrap scriptも受け取ります。 どちらの形式も{" "}
          <code>Cache-Control: private, no-store</code> を使います。 GETとPOSTのpre-response
          handlerは既存のVaryフィールドを保持し、Acceptまたは <code>*</code>{" "}
          がなければAcceptを加えます。
        </p>
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
          <a href="/ja/architecture/implementation/routing">ルートパラメーター</a>{" "}
          をデコードします。 失敗するとFlight描画を始めずに本文なしの404を返します。
          POSTは代わりにエンコード済みパラメーターをPageへ渡すため、事前検証はすべてのリクエストには適用されません。
        </p>
        <p>
          <code>rsc/flight.ts</code> の <code>FlightPayload</code> は、<code>routeTree</code>、
          <code>formState</code>、<code>serverFnResult</code> を含みます。
          <code>FlightRenderer</code> はこれを <code>@vitejs/plugin-rsc/rsc/server</code> の{" "}
          <code>renderToReadableStream</code> へ渡し、一時参照があればオプションとして渡します。
          ペイロードが運ぶのは描画データとactionの状態であり、サービスContextの自動的なコピーではありません。
        </p>
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
          が、その実行関数と有効なmiddlewareをAsyncLocalStorageへ保持します。 定義の{" "}
          <code>run</code> は、この束縛と宣言済みのすべてのmiddlewareスコープを要求します。
          どちらかが欠ければ <code>TypeError</code> になり、
          <a href="/ja/architecture/implementation/application">
            定義のサービスとスコープの契約
          </a>{" "}
          を実行時に検査します。
        </p>
        <p>
          <code>server/application.ts</code> は両方の応答形式に{" "}
          <code>Stream.ensuring(flight.release)</code>{" "}
          を付け、HTML開始時の失敗でもFlightを解放します。 Flight開始時の失敗も子Scopeを閉じます。
          Reactのエラーは、signalがabortされていなければ実行関数を通して記録します。
          HTMLの読み込みや開始時の失敗は <code>HtmlRenderError</code>{" "}
          になり、その後の失敗は応答本文を通して伝わります。
        </p>
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
          不正または不完全なUTF-8はbase64へ切り替え、ブラウザーで <code>Uint8Array</code>{" "}
          を復元します。 inline scriptは <code>{"</script"}</code> と <code>{"<!--"}</code>{" "}
          をescapeします。
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
          signalを必要とする可能性があるためです。 読み取りとflushのエラーはstream
          controllerに伝え、
          <a href="/ja/architecture/implementation/request#response-lifetime">
            応答本文の所有者
          </a>{" "}
          が後始末を完了できるようにします。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/navigation",
    title: "06. ブラウザーの遷移",
    description:
      "遷移先の読み込みから画面とブラウザー履歴の更新まで、ページ遷移の実装を読み解きます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "browser-start", title: "初期ツリーを確立し、クライアント遷移を選ぶ" },
      { id: "flight-load", title: "ルートを取得するか、ブラウザーに処理を戻す" },
      { id: "transition-commit", title: "描画の予約とcommitを区別する" },
      { id: "navigation-lifetime", title: "完了したルートを保存し、不要になった描画を退役させる" },
    ],
    content: () => (
      <>
        <p>
          Reactのcommit、ブラウザー履歴のcommit、Flightの完了は別の出来事です。
          遅延データのストリーミング中にもルートを表示できるため、遷移は表示中のツリーと未完了のリソースを両方追跡します。
        </p>
        <p>
          hydrationは <a href="/ja/architecture/implementation/rendering">HTMLに埋め込んだFlight</a>{" "}
          から始まります。 後続の応答も同じ{" "}
          <a href="/ja/architecture/implementation/routing">サーバー生成のルートツリーモデル</a>{" "}
          を運びますが、ドキュメントを新しく作らず既存のReactルートを更新します。
        </p>
        <h2 id="browser-start">初期ツリーを確立し、クライアント遷移を選ぶ</h2>
        <p>
          <code>client/application.ts</code> の <code>activateBrowser</code>{" "}
          は初期Flightペイロードを読み、<code>ReactDOMRenderer.hydrate</code> を呼びます。
          hydrationはReactへ <code>formState</code> を渡し、layout effectがツリーとstate更新関数で{" "}
          <code>BrowserRenderer</code> を初期化するまで待ちます。 その後でrefresh、Server
          Functionのcallback、対応していればクライアントルーターを登録します。
        </p>
        <p>
          <code>client/browser-capabilities.ts</code> は、<code>window.navigation</code> と{" "}
          <code>window.NavigationPrecommitController</code>{" "}
          の両方がある場合だけクライアントルーティングを選びます。
          それ以外では、hydrate済みのページもドキュメント遷移を使います。
          両APIがあっても、一部のイベントはブラウザーに任せます。
        </p>
        <SourceExcerpt source={coreRuntimeSources.navigationEligibility} />
        <p>
          hashのみの変更、download、フォーム、reload、二つのマーカー付き遷移はinterceptしません。
          ドキュメント用のマーカーは、Effrontのフォールバック読み込みの再interceptを防ぎます。
        </p>
        <p>
          <code>browserMain</code> は <code>Effect.scoped</code> と <code>Effect.never</code>{" "}
          でサービスと購読を維持します。
          初期Flightやhydration開始時の失敗は、ブラウザーの失敗画面を表示します。
          React描画中のエラーはレンダラーのError Boundaryが扱います。
        </p>
        <h2 id="flight-load">ルートを取得するか、ブラウザーに処理を戻す</h2>
        <p>
          <code>client/route-loader.ts</code>{" "}
          は履歴遷移で、移動先entryのIDを使ってキャッシュ済みツリーを再利用します。
          それ以外の遷移とキャッシュミスでは、<code>FlightClient.load</code> が{" "}
          <code>Accept: text/x-component</code> を付けてGETします。
          応答ごとのScopeは、初期ペイロードのデコード後も存続できます。
        </p>
        <ul>
          <li>
            <strong>ドキュメントへのフォールバック：</strong>非2xxまたはFlight以外の応答は{" "}
            <code>Document</code> になります。
            ルーターは応答を解放し、要求した移動先をドキュメントとして読み込みます。
          </li>
          <li>
            <strong>読み込みエラー：</strong>通信失敗、解決済みURLの欠落や不正、デコード失敗は{" "}
            <code>FlightLoadError</code> になり、理由はそれぞれ <code>RequestFailed</code>、
            <code>UnexpectedResponse</code>、<code>DecodeFailed</code> です。
          </li>
          <li>
            <strong>Flight：</strong>結果にはペイロード、<code>completed</code>、
            <code>release</code>、<code>resolvedUrl</code> が含まれます。
            ルートツリーのデコード完了は、ストリームの完了を意味しません。
          </li>
        </ul>
        <p>
          公開前に <code>client/client-router.ts</code> が解決済みの移動先を検査します。
          originが異なればドキュメント遷移が必要です。
          同じoriginでもURLが変わる場合、履歴遷移かprecommit
          controllerがない状況ではドキュメントを置き換えます。
          それ以外では、Reactのcommit後にcontrollerでredirectできます。
          要求したhashを保つのは、解決済みURLにhashがなく、origin・path・queryが一致するときだけです。
        </p>
        <h2 id="transition-commit">描画の予約とcommitを区別する</h2>
        <p>
          非同期のTransition Actionが <code>BrowserEffectRunner</code>{" "}
          を通してルートを読み込みます。
          その後、内側のTransitionがツリーを公開しますが、公開はcommitではありません。
        </p>
        <SourceExcerpt source={coreRuntimeSources.navigationPublication} />
        <p>
          <code>browserRenderer.navigate</code>{" "}
          はstate更新を予約し、三つのライフサイクル操作を返します。
        </p>
        <ul>
          <li>
            <code>committed</code> は、<code>client/react-dom-renderer.tsx</code> のlayout effectが{" "}
            <code>browserRenderer.commit(render)</code> を呼ぶと解決します。
          </li>
          <li>
            <code>retired</code> は、置き換えのcommitでツリーを保持する必要がなくなると解決します。
          </li>
          <li>
            <code>discard</code>{" "}
            は、保留中の描画に対して現在のツリーの復元を依頼し、退役を待ちます。
          </li>
        </ul>
        <p>
          キャンセル可能なイベントでは、<code>event.intercept</code> が{" "}
          <code>precommitHandler</code> を使います。
          Reactのcommitを待ち、可能なredirectを適用し、履歴のcommitを記録するcallbackを{" "}
          <code>addHandler</code> に登録します。
          キャンセル不能な履歴遷移は通常のhandlerを使うため、同じように履歴を遅らせられません。
          この経路で準備が失敗するとドキュメントをreloadします。
        </p>
        <p>
          Transition typeは遷移の種類と、判別できる場合には方向を表します。
          リンクによるpushとreplaceは、重複と予約済みtypeを除いた{" "}
          <code>data-effront-transition-types</code> の値を加えられます。
          このラベルはcommitや寿命の規則を変えません。 アプリケーションでの利用方法は{" "}
          <a href="/ja/advanced/client-navigation">クライアントナビゲーションとページ遷移</a>{" "}
          を参照してください。
        </p>
        <h2 id="navigation-lifetime">完了したルートを保存し、不要になった描画を退役させる</h2>
        <p>
          処理中の候補は、表示中の遷移とは別に <code>Loading → Publishing → Rendering</code>{" "}
          を進みます。
          generationのsymbolとAbortControllerにより、新しい遷移は表示中のツリーをすぐ解放せずに、保留中の処理をキャンセルできます。
        </p>
        <p>
          古い読み込みは公開せず解放します。 予約済みの描画はdiscardし、退役後に解放します。
          <code>BrowserRenderer</code>{" "}
          は、表示中のツリーと、復元要求を含む保留中の公開が参照するツリーを保持します。
          そのため、遷移のabortは描画の退役と同じではありません。
          未公開または退役済みのcommitや不正なライフサイクル遷移は <code>TypeError</code>{" "}
          になります。
        </p>
        <p>
          新たに読み込んで表示したルートのキャッシュには、履歴のcommitとFlightの正常完了の両方が必要です。
          <code>NavigationEntryState</code> と <code>NavigationFlightState</code>{" "}
          が独立に追跡します。
        </p>
        <ul>
          <li>
            <strong>履歴が先：</strong>Flightを待ち、キャッシュして解放します。
          </li>
          <li>
            <strong>Flightが先：</strong>
            応答を解放し、履歴entryが分かるまでキャッシュ用callbackを保持します。
          </li>
          <li>
            <strong>ストリームの失敗：</strong>キャッシュせずに解放します。
          </li>
        </ul>
        <p>
          新しいgenerationが始まっていても、描画の退役はそのリソースを解放します。
          キャッシュが保持するのはツリーであり、開いた応答ストリームではありません。
          <code>RouteLoader</code>{" "}
          は破棄された履歴entryを削除し、refresh時にキャッシュのMapを置き換えて、遅れたcallbackによる新キャッシュへの書き込みを防ぎます。
          <a href="/ja/architecture/implementation/server-functions">Server Functionの応答</a>{" "}
          も、同じレンダラーのライフサイクルで現在のページを更新します。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/server-functions",
    title: "07. Server Functionの呼び出しから画面更新まで",
    description:
      "Server Function の呼び出しからサーバー側の処理、画面更新までの実装を読み解きます。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "request-decoding", title: "1. 届いた呼び出しを識別して検証する" },
      { id: "function-definition", title: "2. Reactの参照から型付きの実行処理を取り出す" },
      { id: "execution-outcome", title: "3. Middleware内で実行し結果を描画に渡す" },
      { id: "result-refresh", title: "4. 呼び出し結果を確定してから画面の更新方法を選ぶ" },
    ],
    content: () => (
      <>
        <p>
          ブラウザーからの Server Function 呼び出しに対する正しい Flight
          レスポンスは、呼び出し結果と更新されたルートツリーを含みます。 そのため、関数の失敗がHTTP
          200で届くことがあります。一方、成功しても古くなった応答で、ユーザーが離れたページを復元してはいけません。
          アプリケーションでの利用方法は{" "}
          <a href="/ja/advanced/server-function-execution-and-refresh">実行と画面更新のガイド</a>{" "}
          を参照してください。
        </p>
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
        <h2 id="execution-outcome">3. Middleware内で実行し結果を描画に渡す</h2>
        <p>
          <code>PreparedServerFnRequest</code> は <code>execute</code>{" "}
          と関数のmiddlewareを含みます。
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
        <h2 id="result-refresh">4. 呼び出し結果を確定してから画面の更新方法を選ぶ</h2>
        <p>
          非2xx、Flight以外、結果の欠落は、結果に基づくrefreshを行わずにブラウザーの呼び出しをrejectします。
          有効なSuccessは呼び出し元のPromiseをresolveし、有効なFailureは{" "}
          <code>ServerFnCallError</code> でrejectします。
          Effrontは確定後に継続処理を登録し、Reactの既存Actionの処理がrefresh
          Transitionより先に実行されるようにします。
          両方の結果が同じrefresh判定を使うため、関数の失敗はUIを変更しないことを意味しません。
        </p>
        <p>返されたツリーを再利用できるのは、次の条件を満たす場合だけです。</p>
        <ul>
          <li>最後に開始した呼び出しの応答である。</li>
          <li>ナビゲーションのTransitionが進行中でない。</li>
          <li>
            現在の履歴entryが記録したIDと一致する。または、どちらにもentryがなくURLが変わっていない。
          </li>
        </ul>
        <p>
          古いrefreshの割り込み後も、Effrontは再検査します。後始末の間に別の呼び出しや遷移が先へ進む可能性があるためです。
          適さない応答は解放し、<code>RouteRefresher.refreshCurrentRoute("server-function")</code>{" "}
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
    ),
  },
];
