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
    code: `        const parentScope = yield* Effect.scope;
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
                  void runtime(Effect.logError(error));
                }
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
    const decode = Schema.decodeUnknownEffect(Schema.Tuple(schemas));
    const serverFunction = (...untrustedArgs: ServerFnArguments<typeof input, "Encoded">) => {
      // Unary functions still ignore extra native arguments and decode undefined when omitted.
      const effect = decode(Array.isArray(input) ? untrustedArgs : [untrustedArgs[0]]).pipe(
        // Normalization preserves the positional Type mapping, which the generic branch erases.
        Effect.flatMap((args: ReadonlyArray<unknown>) =>
          handler(...(args as ServerFnArguments<typeof input, "Type">)),
        ),
        Effect.mapError((cause) => new ServerFnOperationError({ cause })),
      );
      const unavailable = Promise.reject<Effect.Success<typeof effect>>(directInvocationError());
      void unavailable.catch(() => undefined);

      return Object.assign(unavailable, {
        [ServerFnInvocationTypeId]: Object.freeze({ effect, identity, middleware }),
      });
    };

    return attachEFFRONTMember(serverFunction, identity, "ServerFn");`,
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
    title: "04. リクエストとサービスの寿命",
    description:
      "Fetchの入口からEffectのLayer構築、レスポンス本文の終了まで、リクエスト単位の所有権を追います。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "fetch-entry", title: "1. HTTP Effectの実行ごとにLayerを構築する" },
      { id: "request-services", title: "2. HTTPのContextとアプリケーションサービスを接続する" },
      { id: "response-lifetime", title: "3. Responseではなく本文の終了まで所有する" },
      { id: "host-boundary", title: "4. ホストの値を型付きで読む境界" },
    ],
    content: () => (
      <>
        <p>
          <a href="/architecture/implementation/application">アプリケーションの定義</a>と
          <a href="/architecture/implementation/routing">ルートの組み立て</a>
          が済むと、次はその定義を一件のHTTPリクエストに結び付けます。 この章では{" "}
          <code>packages/core/src/http.ts</code> から <code>server/application.ts</code>{" "}
          へ進み、サービスを取得する時点と解放する時点を分けて読みます。
        </p>
        <h2 id="fetch-entry">1. HTTP Effectの実行ごとにLayerを構築する</h2>
        <p>
          <code>@effront/core/http</code> の <code>toHttpEffect(application)</code>
          は、現在の <code>HttpServerRequest</code>、<code>Scope</code>、外部サービスを使って
          <code>HttpServerResponse</code> を返すEffectです。
          実行時にContent-Lengthを確認し、安全な非負整数でない値や10 MiB超を413にします。
          この入口の検査はヘッダーがない本文の実測ではありません。Server Functionの本文には
          <a href="/architecture/implementation/server-functions">別の読み取り上限</a>があります。
        </p>
        <SourceExcerpt source={coreRuntimeSources.requestHandler} />
        <p>
          抜粋の <code>HttpRouter.toHttpEffect</code> はEffectの実行中に
          <code>ServerApplication.httpLayer(application)</code>{" "}
          を構築し、生成したルーターをそのまま実行します。
          同じEffect値を再利用しても、Layerとルーターの獲得はリクエストごとです。 毎回新しい{" "}
          <code>Layer.CurrentMemoMap</code>{" "}
          を使うため、ホストの構築時にメモ化されたLayerのインスタンスも再利用しません。
          ホストが提供したContextを引き継ぐため、Layerの獲得中から現在の外部サービスとHTTPリクエストを参照できます。
          Workers互換の <code>createFetchHandler</code> はこのEffectを
          <code>HttpEffect.toWebHandler</code> へ渡し、呼び出しごとに{" "}
          <code>WorkersRequestContext</code> を提供します。
        </p>
        <h2 id="request-services">2. HTTPのContextとアプリケーションサービスを接続する</h2>
        <p>
          <code>server/application.ts</code> の <code>httpLayer</code> は、定義から取得した{" "}
          <code>applicationState.layer</code> と <code>FlightRenderer.layer</code>、
          <code>HtmlRenderer.layer</code> を <code>RequestLayer</code> にまとめます。
          <code>Layer.build(RequestLayer)</code> の結果は <code>applicationServices</code>{" "}
          としてルート登録時に保持されます。 各ルートの <code>RequestContextMiddleware</code>{" "}
          は、実行中のHTTP Contextにそのサービス群を <code>Context.merge</code>{" "}
          して処理を実行します。 型の <code>Services</code>{" "}
          はアプリケーションLayerの出力を表し、HTTPのリクエストサービスやレンダラーとは供給元が異なります。
          Layerの入力である <code>Requirements</code> はHTTP
          Effectの要求として残るため、外部サービスの未提供を型で検出できます。
        </p>
        <p>
          GETではページに至るMiddlewareの列をEffect HTTPのdescriptorとして合成します。
          POSTではReactの参照を復号して初めて呼び出し対象のMiddlewareが分かるため、まずRequest
          Contextを供給し、後からハンドラーを包みます。 この違いは{" "}
          <code>application/middleware.ts</code> の <code>getScopedHttpMiddleware</code> と{" "}
          <code>applyMiddleware</code> に対応します。 HTTP Layerの取得失敗には{" "}
          <code>ApplicationError</code> や <code>PlatformError</code>、ルート処理には{" "}
          <code>HtmlRenderError</code> やServer Functionの失敗という別の型境界があります。
        </p>
        <h2 id="response-lifetime">3. Responseではなく本文の終了まで所有する</h2>
        <p>
          HTTP
          Effectが応答を返しても、遅延して描画されるコンポーネントはまだサービスを必要とします。
          Effect HTTPの <code>toHandled</code> がリクエストScopeを所有し、Web変換の
          <code>scopeTransferToStream</code> がストリームの終了へ解放責任を移します。
          EOF・エラー・キャンセルで本文のEffect Streamが終了するとScopeが閉じます。
          生成済みのJSONやtextなどの非ストリーム応答は、本文を後で読む場合もリクエスト処理の完了で解放されます。
        </p>
        <SourceExcerpt source={coreRuntimeSources.responseLifetime} />
        <p>
          固定しているEffect rc.112はHEADの本文を破棄する前にもScopeをストリームへ移します。
          coreはHEADを空の本文へ正規化し、GETのヘッダーを保ったまま、消費されないストリームへのScope移譲を防ぎます。
          応答生成だけを <code>Effect.scoped</code>{" "}
          で包むと、ストリームの途中でサービスを解放してしまうため、この所有権をホストのHTTP処理へ接続します。
          Flightの子Scopeにも独自のreleaseがあり、
          <a href="/architecture/implementation/rendering">次章</a>でHTTPの寿命との接続を追います。
        </p>
        <p>
          Effect HTTPへ直接接続するホストも、ストリームの寿命に合わせてScopeを所有します。
          coreはホスト固有の転送処理やインフラサービスを持たず、HTTPのEffectと型付きContextを接続境界にします。
          独自の遅延本文がリクエストサービスを読む場合は、その本文を作る時点で必要なContextを束縛します。
          応答を作るEffectへサービスを提供することと、後から実行される本文へContextを提供することは別です。
        </p>
        <h2 id="host-boundary">4. ホストの値を型付きで読む境界</h2>
        <p>
          <code>makeHttpEffect(application)</code> は構築時の外部サービスへの参照を保持します。
          返されたEffectの実行時には現在のContextを優先して合流させるため、同じハンドラーを並行リクエストで使えます。
          <code>captureExternalContext</code>{" "}
          は構築時のScope、HTTPリクエスト、検索パラメーター、RouteContext、HttpRouter、Layer.CurrentMemoMapを除外します。
          <code>Effect.context&lt;R&gt;()</code>{" "}
          の型指定だけでは実行時のキーは絞られないため、この除外が必要です。
        </p>
        <SourceExcerpt source={coreRuntimeSources.externalContext} />
        <p>
          Contextに参照を保持してもサービスの所有権は移りません。
          ホストが構築した共有サービスはホストのScopeに属し、リクエストLayerは今回のHTTP
          Scopeに属します。
          外部サービスの所有者は、それを使うすべての応答本文が終了するまで自身のScopeを保ちます。
          アプリケーションのLayerを構築する処理は、参照を保持するこのfactoryではなく、返されたHTTP
          Effectの内側に残ります。
        </p>
        <p>
          <code>workers.ts</code> の <code>WorkersRequestContext&lt;Env, ExecutionContext&gt;</code>{" "}
          は三つの値をreadonlyで持ちます。 対応する <code>Context.Reference</code>{" "}
          はFetch処理外の未供給アクセスでTypeErrorを投げます。
          <code>
            createWorkersContextAccessors&lt;Env = unknown, ExecutionContext = unknown&gt;()
          </code>{" "}
          は既存のReferenceを読む関数を返すだけで、新しいServiceやLayerを作りません。
          <code>getWorkersEnv()</code> と <code>getWorkersRequestContext()</code>{" "}
          の型指定はホストの値を説明するためのもので、実行時のSchema検証ではありません。
        </p>
        <p>
          パッケージ境界の例として、<code>packages/cloudflare/src/workers.ts</code> は{" "}
          <code>@effront/core/workers</code> のこのfactoryを呼び出します。 公開runtime subpathの{" "}
          <code>@effront/cloudflare/workers</code> では型引数はEnvのみで、ExecutionContextは{" "}
          <code>waitUntil(Promise&lt;unknown&gt;)</code> を持つ{" "}
          <code>CloudflareExecutionContext</code> に固定した薄いラッパーです。
          ビルド統合の入口とは分離されており、ここからenvやexecutionContextをFlightやHTMLへ自動で付加する処理はありません。
          <a href="/architecture/implementation/overview">全体図</a>のホスト境界と、次の
          <a href="/architecture/implementation/rendering">描画境界</a>
          を区別して読み進めてください。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/rendering",
    title: "05. RSCからHTMLへ",
    description:
      "ルートツリーをFlightとして描画し、独立したSSR環境とブラウザーへ分岐するストリームを追います。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "route-to-flight", title: "1. ルートツリーをFlightの入力にする" },
      { id: "render-runtime", title: "2. Reactの描画をリクエストのEffectへ接続する" },
      { id: "ssr-branch", title: "3. SSRとブラウザーにFlightを分岐する" },
      { id: "html-eof", title: "4. HTMLのEOFで安全に埋め込み、cancelを伝える" },
    ],
    content: () => (
      <>
        <p>
          <a href="/architecture/implementation/request">リクエストのサービス</a>がそろうと、
          <code>server/application.ts</code> の <code>render</code> が{" "}
          <code>CompiledDestination</code> を描画します。 読む順序は{" "}
          <code>rsc/render-route-tree.tsx</code>、<code>server/flight-renderer.tsx</code>、
          <code>server/html-renderer.tsx</code>、<code>server/ssr.tsx</code>、
          <code>server/flight-html-stream.ts</code> です。
        </p>
        <h2 id="route-to-flight">1. ルートツリーをFlightの入力にする</h2>
        <p>
          HTTPのURLを絶対パスとして取り出し、
          <a href="/architecture/implementation/routing">ルートのパラメーター</a>
          を用意します。
          POST以外でparamsSchemaがある場合は先にSchemaで復号し、失敗を404の空レスポンスにします。
          <code>renderRouteTree</code>{" "}
          はPageを葉に置き、scopeの列を内側から逆順にたどってLoadingとLayoutを巻き、
          <code>RouteTreeModel</code> を返します。 これはHTML文字列ではなく、<code>id</code>、
          <code>content</code>、<code>child</code> で表したReactのルート構造です。
        </p>
        <p>
          <code>FlightRenderer.render</code> にこのツリーと <code>formState</code>、
          <code>serverFnResult</code>、必要に応じて <code>temporaryReferences</code> を渡します。
          <code>rsc/flight.ts</code> の <code>FlightPayload</code> は先頭の三つを持つ共有契約です。
          サーバーのサービスContextを送信するのではなく、そのContextを使って生成した描画結果をReactのFlightプロトコルで送ります。
        </p>
        <h2 id="render-runtime">2. Reactの描画をリクエストのEffectへ接続する</h2>
        <SourceExcerpt source={coreRuntimeSources.flightRuntime} />
        <p>
          <code>FlightRenderer</code> はEffectのServiceです。
          <code>render</code> の要求環境は <code>Services | Scope.Scope</code>{" "}
          で、親Scopeからforkした <code>renderScope</code> 内に{" "}
          <code>FiberSet.makeRuntimePromise</code> とAbortSignalを作ります。 戻り値の{" "}
          <code>FlightRender</code> は <code>stream</code>、<code>signal</code>、
          <code>release</code>{" "}
          を組にし、ストリームを取得した後も描画用のFiberを生かせるようにしています。 開始時の失敗は{" "}
          <code>Effect.onError</code>{" "}
          でScopeを閉じ、Reactから通知された描画エラーはabort済みでなければこのRuntime経由で記録します。
        </p>
        <p>
          <code>application/render-runtime.ts</code> の <code>renderRuntime.bind</code>{" "}
          は、AsyncLocalStorageにRuntimeと有効なMiddlewareの列を保持します。
          Page、Layout、ComponentがEffectを実行する <code>run</code>{" "}
          はこの値を取得し、必要なMiddlewareが列にすべて含まれることを確認します。
          アプリケーションの描画Runtime外、または必要なMiddlewareのscope外ならTypeErrorです。
          <a href="/architecture/implementation/application">定義時のサービス型</a>
          だけに任せず、Reactの非同期描画時にも接続の不変条件を検査しています。
        </p>
        <h2 id="ssr-branch">3. SSRとブラウザーにFlightを分岐する</h2>
        <p>
          <code>server/application.ts</code> はAcceptが正確に <code>text/x-component</code>{" "}
          と一致すればFlight本文を直接返します。 それ以外は <code>HtmlRenderer</code> が{" "}
          <code>import.meta.viteRsc.loadModule("ssr", "index")</code> で別のSSR環境を読み、
          <code>renderHtml</code> を呼びます。 RSC側の <code>@vitejs/plugin-rsc/rsc/server</code>{" "}
          による描画と、SSR側の <code>@vitejs/plugin-rsc/ssr</code> による復号、
          <code>react-dom/server.edge</code> によるHTML化は別の役割です。
          <code>HtmlRenderer</code> のPromise境界の失敗は <code>HtmlRenderError</code> になります。
        </p>
        <p>
          <code>server/ssr.tsx</code> はFlightストリームを <code>tee()</code> し、一方を{" "}
          <code>createFromReadableStream</code> で復号します。
          <code>SsrRoot</code> は同じpayloadのPromiseを保持して <code>RouteTree</code>{" "}
          を描画し、HTMLレンダラーにはクライアント入口をimportするbootstrap、formState、HTTPのscopeから得たsignalを渡します。
          もう一方のFlightはブラウザー用で、生成したHTMLへ埋め込まれます。 HTTPへ戻す両方の分岐に{" "}
          <code>Stream.ensuring(flight.release)</code>{" "}
          があり、HTML生成開始の失敗にもreleaseが付いています。 動的レスポンスは{" "}
          <code>private, no-store</code>、GET/POSTのpre-response処理は既存値を保って{" "}
          <code>Vary: Accept</code> を追加します。
        </p>
        <h2 id="html-eof">4. HTMLのEOFで安全に埋め込み、cancelを伝える</h2>
        <SourceExcerpt source={coreRuntimeSources.htmlEof} />
        <p>
          <code>flight-html-stream.ts</code> は任意のHTMLチャンク境界をタグ境界と仮定しません。
          <code>makeHtmlWriter</code> が末尾の <code>{"</body></html>"}</code>{" "}
          に一致し得るバイト列を保留し、HTMLのEOFでFlightをscriptとして書き、その後に閉じタグを出力します。
          SSR側はFlightを読み続けるためHTML自体はストリーミングできますが、ブラウザー用のFlightはその間キューにたまります。
          チャンクごとの即時注入とは異なる、EOFを安全な挿入位置とする設計です。
        </p>
        <p>
          Flightの各チャンクはfatalなUTF-8 decoderで独立に復号します。
          不正UTF-8や途中で分割された文字のバイト列はbase64から <code>Uint8Array</code>{" "}
          として復元し、文字列へ無理に置換してバイナリーを壊しません。 inline scriptには{" "}
          <code>{"</script"}</code> と <code>{"<!--"}</code> のescapeもあります。 ブラウザーの{" "}
          <code>client/initial-flight-stream.ts</code> は <code>self.__FLIGHT_DATA</code>{" "}
          の文字列を再encodeし、Uint8Arrayはそのまま流し、DOMContentLoadedで閉じます。
          このストリームが<a href="/architecture/implementation/navigation">hydrationの入力</a>
          です。
        </p>
        <p>
          cancel時は外側のReadableStreamが先にFlight readerをcancelし、lockを解放してからHTML
          readerをcancelします。 teeの片側のcancel Promiseはもう片側を待つため、
          <code>cancelFlight</code> はそのPromiseをawaitしません。
          flush中のFlight待ちと、リクエストScopeのabortを待つ描画が互いを待ち続けないための順序です。
          読み取り・flushのエラーもcontrollerへ伝え、最終的には
          <a href="/architecture/implementation/request#response-lifetime">本文の所有者</a>
          がリクエストを解放します。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/navigation",
    title: "06. ブラウザーの遷移",
    description:
      "hydration後のNavigation API、Flight取得、Reactのcommitと履歴・キャッシュの寿命を分けて追います。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "browser-start", title: "1. 初期Flightでhydrateし、遷移を選別する" },
      { id: "flight-load", title: "2. Flightとドキュメント遷移を判別する" },
      { id: "transition-commit", title: "3. Transitionで公開してReactのcommitを待つ" },
      { id: "navigation-lifetime", title: "4. 履歴・ストリーム・競合の寿命を分ける" },
    ],
    content: () => (
      <>
        <p>
          <a href="/architecture/implementation/rendering">HTMLへ埋め込んだFlight</a>
          は初期表示だけで終わりません。
          <code>client/application.ts</code> を入口に、<code>RouteLoader</code> が取得し、
          <code>BrowserRenderer</code> が公開し、<code>ReactDOMRenderer</code>{" "}
          がcommitを通知する役割分担を読みます。 ルート構造の契約は
          <a href="/architecture/implementation/routing">サーバー側のルーティング</a>
          と共有しています。
        </p>
        <h2 id="browser-start">1. 初期Flightでhydrateし、遷移を選別する</h2>
        <p>
          <code>activateBrowser</code> は <code>routeLoader.loadInitial</code>、
          <code>reactDOMRenderer.hydrate(document, initialPayload)</code>、refreshの登録、Server
          Function callbackの登録、client routerの登録の順に進みます。
          hydrateはformStateをReactへ渡し、layout effectで <code>BrowserRenderer.initialize</code>{" "}
          が済むまで待ちます。
          <code>browserMain</code> は <code>Effect.scoped</code> と <code>Effect.never</code>{" "}
          でブラウザーのサービスと購読を維持し、初期Flightの失敗やhydration開始の失敗は失敗画面へ進みます。
          Reactの描画中のエラーは別途Error Boundaryが報告します。
        </p>
        <p>
          <code>client/browser-capabilities.ts</code> は <code>window.navigation</code> と{" "}
          <code>window.NavigationPrecommitController</code> の両方がある場合だけclient
          routerを有効にします。 それ以外はドキュメント遷移を使います。
          <code>client/navigation-api.ts</code> はブラウザーのNavigation APIをEffect
          Serviceとして包むもので、react-routerライブラリーのルーターではありません。
        </p>
        <SourceExcerpt source={coreRuntimeSources.navigationEligibility} />
        <p>
          <code>client/navigation-routing.ts</code>{" "}
          はintercept可能な遷移のうち、hash変更、download、form送信、reload、React側の識別情報と明示的なドキュメント遷移を除外します。
          すべてのリンク操作をFlight取得に置き換えるのではなく、ブラウザーに任せる操作を入口で分けています。
        </p>
        <h2 id="flight-load">2. Flightとドキュメント遷移を判別する</h2>
        <p>
          <code>client/route-loader.ts</code>{" "}
          はtraverse時だけ履歴entryのidでキャッシュを参照し、なければ <code>FlightClient.load</code>{" "}
          へ進みます。
          <code>client/flight-client.ts</code> は子のresponseScopeをforkし、Acceptに{" "}
          <code>text/x-component</code> を付けたGETをEffectのHttpClientで実行します。
          2xx以外、またはFlight以外のContent-Typeはナビゲーションでは <code>Document</code>{" "}
          として返し、routerが資源をreleaseしてドキュメント遷移に切り替えます。
          一方、通信失敗・復号失敗は <code>FlightLoadError</code> で、理由は{" "}
          <code>RequestFailed</code>、<code>UnexpectedResponse</code>、<code>DecodeFailed</code>{" "}
          に区別します。
        </p>
        <p>
          Flightの戻り値にはpayloadだけでなく、本文終端を表す <code>completed</code>、解放用の{" "}
          <code>release</code>、redirect後の <code>resolvedUrl</code> があります。
          ルートの先頭が復号できる時点と、遅延したデータまで届く時点は同じではありません。
          routerは解決先が別originならドキュメントへ移り、同一originでもprecommit
          redirectが使えない場合やtraverseでは必要に応じてdocument replaceへ切り替えます。
          URLのorigin・path・queryが同じで応答側にhashがないときだけ、要求されたhashを保持します。
        </p>
        <h2 id="transition-commit">3. Transitionで公開してReactのcommitを待つ</h2>
        <SourceExcerpt source={coreRuntimeSources.navigationPublication} />
        <p>
          <code>client/client-router.ts</code>{" "}
          は各遷移にsymbolのgenerationとAbortControllerを与え、読み込み後のRouteを{" "}
          <code>startTransition</code> 内で <code>browserRenderer.navigate</code> に公開します。
          その外側にも非同期のTransition Actionがあり、Effectの実行は{" "}
          <code>BrowserEffectRunner</code> を通してPromise境界に接続されます。
          <code>addTransitionType</code> はpush・replace・traverseや進行方向を付記し、リンクの{" "}
          <code>data-effront-transition-types</code> は予約語を除いて重複を除去します。
          これはTransitionへの分類情報です。Page の既定の ViewTransition
          境界はこの情報を利用します。設定方法は Advanced のページ遷移の章で説明します。
        </p>
        <p>
          <code>client/browser-renderer.ts</code> の <code>navigate</code>{" "}
          はReactのstate更新を公開し、<code>committed</code>、<code>retired</code>、
          <code>discard</code> を返します。
          <code>client/react-dom-renderer.tsx</code> のlayout effectが{" "}
          <code>browserRenderer.commit(render)</code>{" "}
          を呼ぶまで、state更新の依頼はcommitではありません。 routerは <code>committed</code>{" "}
          を待った後に履歴への接続を進めます。 cancel可能なら <code>event.intercept</code>{" "}
          のprecommitHandlerを使い、redirectを調整してaddHandlerで履歴commitを追跡します。
          cancel不能なtraverseでは通常のhandlerを使い、準備中の失敗にはdocument
          reloadの経路があります。
        </p>
        <h2 id="navigation-lifetime">4. 履歴・ストリーム・競合の寿命を分ける</h2>
        <p>
          routerの状態は候補の <code>Loading → Publishing → Rendering</code> と、現在見えている{" "}
          <code>visible</code> を分けています。
          新しい遷移は候補のlifetimeをabortしますが、見えているツリーを即座に破棄しません。
          公開済みの未commit候補は <code>discard</code>{" "}
          で復元用の描画を依頼し、retirementを待ってから資源を解放します。
          古いgenerationから届いたRouteLoadedもreleaseへ回し、古い結果が新しい画面を上書きするのを防ぎます。
          二重commitや公開していないツリーのcommitはTypeErrorとなる内部不変条件です。
        </p>
        <p>
          キャッシュ保存にはFlightの正常完了と履歴commitの両方が必要です。
          どちらが先でも処理できるよう <code>NavigationEntryState</code> と{" "}
          <code>NavigationFlightState</code> を分け、ストリーム失敗ではreleaseだけを行います。
          entryのdisposeでキャッシュを消し、refreshではMap自体を入れ替えるため、古い取得結果の遅延保存は新しいキャッシュを汚しません。
          描画のretirementにもreleaseを結び付け、キャッシュされたツリーと開いた通信資源を同一視しない構成です。
          同じ仕組みを使って現在画面を更新する
          <a href="/architecture/implementation/server-functions">Server Functionの応答処理</a>
          へ進みます。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/server-functions",
    title: "07. Server Functionの実行",
    description:
      "Reactの呼び出しをSchemaとMiddlewareへ接続し、フォーム送信・実行結果・画面更新の順序を追います。",
    section: "アーキテクチャ",
    group: "実装解説",
    headings: [
      { id: "function-definition", title: "1. Schema付きの実行記述を作る" },
      { id: "request-decoding", title: "2. POSTを検査しReactの引数を復号する" },
      { id: "execution-outcome", title: "3. Middleware内で実行しフォームと結果を分ける" },
      { id: "result-refresh", title: "4. 呼び出し結果を確定してから画面を更新する" },
    ],
    content: () => (
      <>
        <p>
          この章では <code>application/server-fn.ts</code> で作った関数が{" "}
          <code>server/server-fn-request.ts</code> で認識され、<code>server/application.ts</code>{" "}
          の再描画を経て <code>client/call-server.ts</code> に戻るまでを追います。
          <a href="/architecture/implementation/application">アプリケーションのidentity</a>、
          <a href="/architecture/implementation/request">リクエストContext</a>、
          <a href="/architecture/implementation/rendering">Flight</a>
          が一つの呼び出しで接続される箇所です。
        </p>
        <h2 id="function-definition">1. Schema付きの実行記述を作る</h2>
        <SourceExcerpt source={coreRuntimeSources.serverFnSchema} />
        <p>
          <code>makeServerFnFactory</code> の <code>input</code>{" "}
          は単一Schemaまたは位置付きSchemaの配列です。
          呼び出し側の型はEncoded、handler側の型はTypeで、<code>Schema.Tuple</code>{" "}
          の復号後にhandlerのEffectを実行します。
          単一Schemaの場合は最初の引数だけを取り、欠落時はundefinedを復号します。配列指定は引数列をそのまま検証します。
          復号にもhandlerにも <code>AvailableServices</code> を要求でき、失敗は{" "}
          <code>ServerFnOperationError</code> に包みます。
        </p>
        <p>
          返すPromiseには、Effect・identity・Middlewareを持つ内部brandが付いています。
          この関数をサーバー内で直接awaitするとTypeErrorでrejectする一方、HTTP側は{" "}
          <code>matchServerFnInvocation</code>{" "}
          でbrandとアプリケーションidentityを確かめ、実行記述を取り出します。
          他のEFFRONTモジュールの関数ならidentity不一致として扱い、brandのないネイティブなReact
          Server FunctionはPromise結果をEffectで待つ経路へ進みます。
          この接続により、Reactのネイティブな参照解決の後もアプリケーションのサービス境界を確認できます。
        </p>
        <h2 id="request-decoding">2. POSTを検査しReactの引数を復号する</h2>
        <p>
          <code>server/application.ts</code> は各destinationのPOSTを{" "}
          <code>prepareServerFnRequest</code> に渡します。 最初の <code>validateOrigin</code>{" "}
          はOriginを必須とし、そのURLのhostをHostヘッダーの小文字化した値と比較します。
          これはschemeまで含むorigin全体の比較ではありません。欠落・不一致・URL解析失敗は403です。
          次にscopeのAbortSignal付きでWeb Requestへ変換し、<code>x-effront-server-fn</code>{" "}
          ヘッダーがあればクライアント呼び出し、なければprogressive
          enhancementのフォーム経路を選びます。
        </p>
        <p>
          <code>readBodyBytes</code> は実際に読み取ったバイト数を数えて10 MiBを超えたら400にします。
          入口のContent-Lengthによる413とは別の検査です。
          読んだ本文をRequestへ再構成し、multipartならFormData、それ以外ならtextとしてReactへ渡します。
          読み取り・フォーム解析の失敗も <code>ServerFnRequestError</code> になります。
        </p>
        <SourceExcerpt source={coreRuntimeSources.serverFnDecode} />
        <p>
          クライアント呼び出しは <code>decodeReply</code> の配列サイズ上限10,000とtemporary
          reference setを使い、さらに <code>Schema.Array(Schema.Unknown)</code>{" "}
          で引数列であることを確認します。
          <code>loadServerAction</code> の参照解決失敗も400です。
          この段階の配列検査と、関数自身のinput Schemaによる業務入力の復号は別の処理です。
          <code>temporaryReferences</code> は応答のFlightにも引き継ぎ、ブラウザーの{" "}
          <code>encodeReply</code> と復号側の参照集合を対応させます。
        </p>
        <h2 id="execution-outcome">3. Middleware内で実行しフォームと結果を分ける</h2>
        <p>
          準備結果は <code>PreparedServerFnRequest</code> の <code>execute</code> と{" "}
          <code>middleware</code> です。
          <code>executeServerFnAndRefresh</code>{" "}
          は関数のMiddlewareで実行と再描画を包み、destination側で不足するMiddlewareだけを再描画に追加します。
          共有するMiddlewareを二度適用せず、関数のサービスとページ更新のサービスを同じリクエストの中で接続します。
          再描画に渡すMiddleware一覧にも両方を含め、描画Runtimeのscope検査と一致させます。
        </p>
        <p>
          クライアント呼び出しの実行は <code>server/server-fn-outcome.ts</code> の{" "}
          <code>serverFnOutcome</code> がExitを観測します。 通常の失敗は <code>serverFnResult</code>{" "}
          のFailure、成功はSuccessとして、どちらもHTTP 200の再描画結果に入ります。
          割り込みはFailureデータに変えず再度interruptします。 その前段の{" "}
          <code>normalizeServerFnFailure</code>{" "}
          も割り込みを維持し、それ以外を実行エラーに正規化します。
          HTTP成功と関数成功を同一視してはいけない理由が、この二段の表現にあります。
        </p>
        <p>
          JavaScriptなしのフォームはmultipartを必須とし、<code>decodeAction</code>{" "}
          でReactのactionを復号します。 actionがない・復号できない場合は400、実行や{" "}
          <code>decodeFormState</code> の失敗は500です。 成功時は <code>formState</code> と{" "}
          <code>serverFnResult: null</code>{" "}
          を持つ200の描画へ進み、通常のフォーム要求ではHTMLが返ります。
          そのformStateをSSRとhydrationの双方へ渡すことでReactのフォーム状態を引き継ぎます。
          <code>ServerFnRequestError</code>{" "}
          はPOSTルートで捕捉され、指定statusとテキスト本文に変換されます。
        </p>
        <h2 id="result-refresh">4. 呼び出し結果を確定してから画面を更新する</h2>
        <p>
          <code>client/call-server.ts</code> の <code>setServerCallback</code>{" "}
          は呼び出し時の履歴entryまたはURLと単調増加するorderを記録し、<code>encodeReply</code>{" "}
          した引数をそのURLへPOSTします。
          <code>FlightClient</code> はServer
          Functionの非2xxや非Flight応答をエラーにし、欠けた戻り値も <code>ServerFnCallError</code>{" "}
          になります。 Successなら呼び出し元Promiseを値でresolveし、Failureならrejectします。
          そのPromiseにReactが先に登録したActionの処理が進んでから、Effrontのrefreshを始める順序です。
        </p>
        <p>
          成功時にも単純に応答のツリーを上書きするのではありません。
          最新の呼び出しで、遷移中ではなく、履歴entryまたはURLが呼び出し時と一致するときだけ応答のツリーを採用します。
          進行中のrefreshをinterruptした後にも条件を再確認します。
          条件が変わった場合は古い応答をreleaseし、
          <code>RouteRefresher.refreshCurrentRoute("server-function")</code>{" "}
          で現在のルートを取得し直します。
          Failureの戻り値を通知した場合も同じrefresh判定へ進むため、「失敗なら画面更新しない」という実装ではありません。
        </p>
        <p>
          応答を採用する場合は <code>RouteLoader.prepareRefresh</code> でキャッシュを無効化し、
          <code>startTransition</code> と <code>addTransitionType("server-function")</code>{" "}
          の中で新しいツリーを公開します。 commit PromiseをそのTransition
          Actionの戻り値にせず、本文完了とReactのcommitを別Fiberで待ってからキャッシュを保存します。
          retirementが先ならその待機を終え、いずれも <code>resource.release</code>{" "}
          で通信資源を閉じます。
          <code>client/route-refresh.ts</code>{" "}
          の再取得経路も遷移が落ち着くのを待ち、新たな遷移と競合させるため、更新が別画面を取り戻すことを防ぎます。
          <a href="/architecture/implementation/navigation">遷移の寿命</a>と照合し、
          <a href="/architecture/implementation/overview">全体図</a>
          へ戻ると、定義・HTTP・Flight・ブラウザーが別々の所有権でつながっていることを確認できます。
        </p>
      </>
    ),
  },
];
