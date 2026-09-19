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
    title: "04. リクエストのサービスとその寿命",
    description:
      "リクエストがアプリケーションサービスを取得し、ストリーミング中も維持する仕組みと、ホスト所有のサービスを借りて使う境界を追います。",
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
          ストリーミングレスポンスは、それを生成した処理が終わった後も続くことがあります。
          アプリケーションサービスをいつまで安全に使えるかを理解するには、リクエストがサービスを取得する仕組みと、最終的に誰が解放するかの両方を追う必要があります。
          この章では、HTTPの入口からルートの実行、レスポンス本文の終了まで所有権をたどり、最後に再利用可能なハンドラーがホストのサービスを借りる仕組みを説明します。
        </p>
        <p>
          出発点は、Layerと<a href="/ja/architecture/implementation/routing">登録済みのルート</a>
          を持つ<a href="/ja/architecture/implementation/application">アプリケーション定義</a>です。
          実装は <code>packages/core/src/http.ts</code> と{" "}
          <code>packages/core/src/server/application.ts</code> にあります。
          リクエスト間でサービスが共有される問題や、描画が終わる前にリソースが解放される問題を調べるときは、この経路を確認してください。
        </p>
        <h2 id="fetch-entry">1. 現在のリクエスト用にサービスを取得する</h2>
        <p>
          <code>toHttpEffect(application)</code> は、現在の <code>HttpServerRequest</code>{" "}
          を処理して <code>HttpServerResponse</code> を返すEffectを作ります。
          呼び出し側は、リクエストのScopeと、アプリケーションLayerが必要とする外部サービスを供給します。
          このEffectを作るだけではアプリケーションサービスは構築されず、リクエストに対してEffectを実行するときに取得されます。
        </p>
        <SourceExcerpt source={coreRuntimeSources.requestHandler} />
        <p>
          新しい <code>Layer.CurrentMemoMap</code>{" "}
          により、今回の取得はホストの構築時にメモ化済みのLayerから切り離されます。
          <code>HttpRouter.toHttpEffect</code> はその実行の中でアプリケーションのHTTP
          Layerを構築し、得られたハンドラーを直ちに実行します。
          そのため、同じEffectを再利用しても、現在のリクエストとホスト提供のサービスを参照しながら、実行ごとにリクエストLayerを構築します。
        </p>
        <p>
          サービスの取得前に、入口ではContent-Lengthが指定されていればその数値を調べ、安全な非負整数でない場合や10
          MiBを超える場合に413を返します。
          これはヘッダーの検査であり、ヘッダーがない本文のサイズを実測するものではありません。
          <a href="/ja/architecture/implementation/server-functions">Server Functionの復号処理</a>
          では、本文の読み取り時に別の上限を適用します。
        </p>
        <p>
          Web Fetchへの橋渡しも同じ経路を使います。
          <code>workers.ts</code> の <code>createFetchHandler</code> は、このEffectを{" "}
          <code>HttpEffect.toWebHandler</code> に渡し、呼び出しごとに新しい{" "}
          <code>WorkersRequestContext</code> を供給します。
          この橋渡しはホストの値を供給するものであり、リクエスト単位の取得の仕組みを置き換えるものではありません。
        </p>
        <h2 id="request-services">2. 取得したサービスをルートで使えるようにする</h2>
        <p>
          <code>ServerApplication.httpLayer</code> では、<code>RequestLayer</code>{" "}
          がアプリケーションのLayerと <code>FlightRenderer.layer</code>、
          <code>HtmlRenderer.layer</code> をまとめます。
          <code>Layer.build(RequestLayer)</code> が生成する <code>applicationServices</code>{" "}
          のContextは、今回のリクエスト用のルートMiddlewareに保持されます。
          <code>RequestContextMiddleware</code> はルートの実行前に、そのContextを実行中のHTTP
          Contextへ合流させます。
          これにより、ルートの処理は現在のHTTPサービスと、アプリケーション用に取得したばかりのサービスの両方を使えます。
        </p>
        <p>
          この境界の二つの型引数も、同じ関係を表します。
          <code>Services</code> はアプリケーションLayerが供給するものを、<code>Requirements</code>{" "}
          はその構築や実行に供給が必要なものを表します。
          外部への要求は、ルーターを組み立てても消えず、HTTP Effectの型に残ります。
        </p>
        <p>
          サービスを使える状態にした後、Middlewareが選択された処理を包みます。
          GETルートは、ページのMiddlewareをEffect HTTPのMiddleware descriptorで合成します。
          POSTルートは、まずReactのServer
          Function参照を復号し、選ばれた関数のMiddlewareと、ページの再描画に追加で必要なMiddlewareを適用します。
          どちらも今回のリクエストで取得したサービスを使いますが、関数固有のMiddlewareは、復号によって関数を特定するまで選べません。
        </p>
        <h2 id="response-lifetime">3. レスポンス本文が終わるまでリソースを維持する</h2>
        <p>
          <code>HttpServerResponse</code>{" "}
          を返しても、ストリーミング描画がサービスを使い終えたとは限りません。
          ホストは、本文の終了、失敗、キャンセルまでリクエストのScopeを開いたままにする必要があります。
          Effect HTTPのWebハンドラーは、この寿命をレスポンスストリームへ自動的に引き継ぎます。
          生成済みのtextなどの非ストリーム応答では、呼び出し側が本文を読むのを待たず、リクエスト処理の完了時にリソースを解放します。
        </p>
        <SourceExcerpt source={coreRuntimeSources.responseLifetime} />
        <p>
          HEADは本文が消費されないため、特別な扱いが必要です。 固定しているEffect
          rc.112は、HEADの本文を破棄する前にストリーミングレスポンスのScopeを移譲します。
          Effrontはレスポンスヘッダーを保ちながら本文を <code>HttpBody.empty</code>{" "}
          に置き換え、読まれないストリームへ所有権が移ることを防ぎます。
        </p>
        <p>
          HTTP Effectに直接接続するホストも、同じ寿命の境界を守る必要があります。
          レスポンスを生成する部分だけを <code>Effect.scoped</code>{" "}
          で包むと、遅延して実行される本文には早すぎる時点でリソースを解放してしまいます。
          独自の本文が後からサービスを読む場合は、本文の構築時に必要なContextも束縛してください。
          サービスを生かしておくことと、後から動くEffectで使えるようにすることは別の責務です。
        </p>
        <p>
          描画処理は、Flight用の子Scopeと、ストリームの終了に結び付いた明示的な解放処理を追加します。
          <a href="/ja/architecture/implementation/rendering">描画の章</a>
          では、その子ScopeがHTTPレスポンスの寿命にどう接続するかを追います。
        </p>
        <h2 id="host-boundary">4. リクエストの状態を持ち越さずにホストのサービスを再利用する</h2>
        <p>
          多くのリクエストが使うサービスを、ホストがすでに所有している場合があります。
          <code>makeHttpEffect(application)</code>{" "}
          は、そうした外部サービスへの参照を保持し、再利用可能なHTTP Effectを返します。
          構築時にアプリケーションのリクエストLayerを取得することも、保持したサービスの所有権を引き取ることもありません。
          所有者は、そのサービスを使うすべてのレスポンス本文が終わるまで存続する必要があります。
        </p>
        <SourceExcerpt source={coreRuntimeSources.externalContext} />
        <p>
          Contextの合流では、保持済みの値よりも実行中のリクエストContextを優先します。 その前に{" "}
          <code>captureExternalContext</code>{" "}
          が、構築時のScope、HTTPリクエスト、解析済みの検索パラメーター、ルートContext、ルーター、Layerのmemo
          mapを除外します。
          <code>Effect.context&lt;R&gt;()</code>{" "}
          の型引数は実行時のキーを絞り込まないため、この明示的な除外が必要です。
          ハンドラーを再利用するときに、構築時にたまたま存在したリクエストの状態を復元してはいけません。
        </p>
        <p>
          Fetchホストでは、<code>WorkersRequestContext</code> が現在の <code>request</code>、
          <code>env</code>、<code>executionContext</code> をreadonlyフィールドに保持します。
          <code>createWorkersContextAccessors</code>{" "}
          は、既存の参照を読む型付きの関数を作るもので、別のServiceやLayerを作るものではありません。
          型はホスト提供の値を説明するだけで実行時には検証せず、参照が供給されていない状態で読むと{" "}
          <code>TypeError</code> を投げます。
        </p>
        <p>
          <code>@effront/cloudflare/workers</code> は、この読み取り関数の型を、
          <code>waitUntil(Promise&lt;unknown&gt;)</code> を持つ{" "}
          <code>CloudflareExecutionContext</code> に具体化します。
          これはビルド統合とは別のアダプター境界であり、ホストの値はEffect
          Contextにとどまり、FlightやHTMLに自動で追加されません。
          <a href="/ja/architecture/implementation/overview">アーキテクチャの全体図</a>
          と合わせて読むと、ホストによる共有サービスの所有、リクエストごとの取得、レスポンスのストリーミング期間を区別できます。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/rendering",
    title: "05. ルートからHTMLとFlightへ",
    description:
      "一つのルート描画からHTMLとFlightを返し、リクエストのサービスを維持しながら初期描画のデータをブラウザーへ届ける流れを追います。",
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
          ドキュメントのリクエストには表示用のHTMLが必要で、アプリ内の遷移には新しいReactのルートツリーが必要です。
          Effrontは用途ごとにPageを別実装するのではなく、どちらもFlightの描画結果から返します。
          この章ではその共通経路を追い、レスポンス形式が想定と違うとき、描画に必要なサービスを利用できないとき、ストリームが終了しないときに、どの境界を調べればよいかを説明します。
        </p>
        <h2 id="ssr-branch">一つの描画から二つのレスポンス形式を返す</h2>
        <p>
          出発点は、ルーティングで描画先が決まり、
          <a href="/ja/architecture/implementation/request">リクエストのサービスを取得した</a>
          後に呼ばれる、<code>packages/core/src/server/application.ts</code> の <code>render</code>{" "}
          です。 まず <code>FlightRenderer</code> にルートの描画を依頼します。
          その後でストリームの返し方を選び、Acceptヘッダーが <code>text/x-component</code>{" "}
          と完全に一致すればFlightを、それ以外ならHTMLを返します。
          これは完全一致による判定であり、Acceptの候補リストからメディアタイプを選ぶ処理ではありません。
        </p>
        <p>
          HTMLを返す場合、<code>HtmlRenderer</code> は{" "}
          <code>import.meta.viteRsc.loadModule("ssr", "index")</code>{" "}
          で独立したSSR環境を読み込みます。
          <code>server/ssr.tsx</code> では、<code>tee()</code>{" "}
          によってFlightストリームを二つの読み手に分けます。 SSR側は{" "}
          <code>@vitejs/plugin-rsc/ssr</code> でペイロードを復号し、その <code>RouteTree</code> を{" "}
          <code>react-dom/server.edge</code> でHTMLに描画します。
          もう一方はブラウザー向けにFlightデータを保持し、そのHTMLに埋め込まれます。
          つまりSSRはRSCの結果を利用する処理であり、Pageのサーバー側の描画Effectを独立してもう一度実行する処理ではありません。
        </p>
        <p>
          HTMLレンダラーには、フォームの状態、リクエストのScopeに結び付いたAbortSignal、クライアント入口をimportするbootstrap
          scriptも渡します。 どちらのレスポンス形式にも{" "}
          <code>Cache-Control: private, no-store</code> を設定します。 GETとPOSTのpre-response
          handlerは既存のVaryフィールドを維持し、Acceptまたは <code>*</code>{" "}
          が含まれていなければAcceptを追加して、形式の違いをキャッシュに伝えます。
        </p>
        <h2 id="route-to-flight">共通のFlightペイロードを組み立てる</h2>
        <p>
          二つの読み手が受け取る内容を知るには、<code>rsc/render-route-tree.tsx</code> の{" "}
          <code>renderRouteTree</code> を追います。
          一致したPageを起点に、描画先のScopeを内側から外側へたどり、それぞれのLoading境界とLayoutを追加します。
          戻り値はHTML文字列ではなく、<code>id</code>、<code>content</code>、<code>child</code>{" "}
          を持つ <code>RouteTreeModel</code> です。
          LayoutのIDにはScopeの識別子を使い、PageとLoadingのIDにはpathnameも含めます。
        </p>
        <p>
          POST以外のリクエストでPageにパラメーターSchemaがある場合は、ツリーを組み立てる前に
          <a href="/ja/architecture/implementation/routing">ルートのパラメーター</a>を復号します。
          復号に失敗すると、Flightの描画を始めずに空の404レスポンスを返します。
          POSTでは符号化されたパラメーターを描画経路へ渡すため、この事前検査があらゆる描画の前に行われるわけではありません。
        </p>
        <p>
          <code>rsc/flight.ts</code> は、<code>routeTree</code>、<code>formState</code>、
          <code>serverFnResult</code> を持つ共通の <code>FlightPayload</code> を定義します。
          <code>FlightRenderer</code> はこのオブジェクトを{" "}
          <code>@vitejs/plugin-rsc/rsc/server</code> の <code>renderToReadableStream</code>{" "}
          に渡し、temporary referencesがあれば描画オプションとして渡します。
          ペイロードが運ぶのは描画結果とアクションの状態であり、サーバーのサービスContextが自動で複製されるわけではありません。
        </p>
        <h2 id="render-runtime">非同期の描画をリクエストの中で実行する</h2>
        <p>
          読み取り可能なストリームを取得できても、Reactがその内容をすべて描画し終えたとは限りません。
          Page、Layout、Componentは、その後も現在のリクエストのサービスを使ってEffectを実行することがあります。
          そこで <code>FlightRenderer</code>{" "}
          は描画用の子Scopeを作り、ストリームとAbortSignalに加えて、そのScopeを解放する操作も返します。
        </p>
        <SourceExcerpt source={coreRuntimeSources.flightRuntime} />
        <p>
          <code>FiberSet.makeRuntimePromise</code>{" "}
          がReactの描画中に使うPromiseベースの実行関数を提供し、そのFiberは <code>renderScope</code>{" "}
          に属します。
          <code>application/render-runtime.ts</code> の <code>renderRuntime.bind</code>{" "}
          は、AsyncLocalStorageを使い、この実行関数と有効なMiddlewareの列を非同期の描画処理から利用できるようにします。
          Page、Layout、Componentが <code>run</code>{" "}
          を呼ぶときには、結び付けられたRuntimeと、その定義が要求するすべてのMiddlewareのScopeが必要です。
          いずれかが欠けると接続の誤りとして <code>TypeError</code> を報告し、
          <a href="/ja/architecture/implementation/application">定義時に確立したサービスの契約</a>
          を実行時にも補います。
        </p>
        <p>
          解放のタイミングは、ストリームを作る呼び出しの終了ではなく、レスポンスのライフサイクルに結び付きます。
          <code>server/application.ts</code> は両方のレスポンス本文に{" "}
          <code>Stream.ensuring(flight.release)</code>{" "}
          を付け、HTMLの生成開始に失敗した場合にもFlightを解放します。
          Flightの生成開始に失敗した場合も子Scopeを閉じ、Reactが報告したエラーはSignalがabort済みでなければそのRuntimeを通じて記録します。
          HTMLの読み込みと描画を開始するPromise境界の失敗は <code>HtmlRenderError</code>{" "}
          になり、その後のストリームの失敗はレスポンス本文を通じて伝わります。
        </p>
        <h2 id="html-eof">HTMLストリームを壊さずにFlightを届ける</h2>
        <p>
          HTMLレスポンスは、表示用のマークアップと、ブラウザーがhydrationに使うFlightのバイト列を両方運ぶ必要があります。
          HTMLチャンクはタグなどの構文の途中で終わることがあるため、任意のチャンクの直後にscriptを挿入するのは安全ではありません。
          <code>server/flight-html-stream.ts</code>{" "}
          は代わりにHTMLのEOFを待ち、そこでブラウザー向けのFlightを挿入します。
        </p>
        <SourceExcerpt source={coreRuntimeSources.htmlEof} />
        <p>
          <code>makeHtmlWriter</code> はマークアップを転送しながら、末尾の{" "}
          <code>{"</body></html>"}</code> に一致する可能性のあるバイト列を保留します。
          EOFに達すると、transformがFlightのscriptを書き込み、その後で閉じタグを出力します。
          SSR側がFlightを読み続けるためHTML自体はストリーミングできますが、ブラウザー向けの分岐は挿入位置に達するまでキューにたまります。
          HTMLの各チャンクに合わせて、埋め込みFlightも逐次届く設計ではありません。
        </p>
        <p>
          挿入位置と同じくらい、バイト列の保存も重要です。 Flightの各チャンクをfatalなUTF-8
          decoderで独立に復号し、不正または不完全なUTF-8ならbase64へ切り替え、ブラウザーで{" "}
          <code>Uint8Array</code> に復元します。 inline scriptでは <code>{"</script"}</code> と{" "}
          <code>{"<!--"}</code> の並びもescapeします。
          <code>client/initial-flight-stream.ts</code> は <code>self.__FLIGHT_DATA</code>{" "}
          の文字列をバイト列へ戻し、バイト配列は変更せずに流し、DOMContentLoadedでストリームを閉じます。
          ドキュメントの準備が済んでいれば直ちに閉じます。 このストリームが
          <a href="/ja/architecture/implementation/navigation">ブラウザーのhydration</a>
          への入力になります。
        </p>
        <p>
          キャンセルも、互いを待ち続けることなく両方の分岐へ伝える必要があります。
          外側のReadableStreamはFlight readerをキャンセルしてlockを解放してから、HTML
          readerをキャンセルします。 Flightのtee分岐のキャンセルPromiseは意図的にawaitしません。
          このPromiseはもう一方の分岐を待つことがあり、その分岐の終了にはリクエストのAbortSignalが必要な場合があるためです。
          読み取りとflushのエラーもストリームのcontrollerに伝え、
          <a href="/ja/architecture/implementation/request#response-lifetime">
            レスポンス本文の所有者
          </a>
          が描画処理を残さずにリクエストの後始末を完了できるようにします。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/navigation",
    title: "06. ブラウザーの遷移",
    description:
      "リンクによる遷移をFlight取得からReactと履歴のcommitまで追い、通信資源を解放できる時点とルートをキャッシュできる条件を理解します。",
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
          クライアント遷移では、遷移先のFlightデータがすべて届く前に、新しいルートを表示できます。
          Reactによるツリーのcommit、ブラウザーによる履歴エントリーのcommit、応答ストリームの完了は、それぞれ別の出来事です。
          この章ではリンクによる遷移をこの三つの境界に沿って追い、ドキュメント読み込みに切り替わる理由、「戻る」でルートを再利用できる条件、新しい遷移が未完了の処理に取って代わる仕組みを理解します。
        </p>
        <p>
          出発点は、
          <a href="/ja/architecture/implementation/rendering">初期HTMLに埋め込まれたFlight</a>です。
          以降の応答も同じ
          <a href="/ja/architecture/implementation/routing">
            サーバールーティングが生成するルートツリー
          </a>
          を運びますが、既存のReactルートを更新するには、新しいドキュメントを読み込む場合にはない調整が必要です。
        </p>
        <h2 id="browser-start">初期ツリーを確立し、クライアント遷移を選ぶ</h2>
        <p>
          ルートを置き換える前に、ブラウザーのランタイムには、次の読み込み中も表示を続けられる描画済みのツリーが必要です。
          <code>client/application.ts</code> の <code>activateBrowser</code>{" "}
          は初期Flightのpayloadを読み込み、<code>ReactDOMRenderer.hydrate</code> に渡します。
          hydrationでは <code>formState</code> をReactに渡し、layout
          effectが初期ツリーとReactのstate更新関数で <code>BrowserRenderer</code>{" "}
          を初期化するまで待ちます。 その後にルートのrefresh、Server
          Functionのcallback、対応している場合はクライアントルーターを登録します。
        </p>
        <p>
          対応の条件は <code>window.navigation</code> と{" "}
          <code>window.NavigationPrecommitController</code> の両方が存在することで、
          <code>client/browser-capabilities.ts</code> が判定します。
          条件を満たさない場合、ページがhydrateされていても、遷移はドキュメント読み込みのままです。
          両APIを利用できる場合も、ルーターはすべての遷移をFlightリクエストに変えるのではなく、一部の操作をブラウザーに任せます。
        </p>
        <SourceExcerpt source={coreRuntimeSources.navigationEligibility} />
        <p>
          対象となるイベントはintercept可能で、hashのみの変更、download、フォーム送信、reloadのいずれでもない必要があります。
          二つの <code>info</code>{" "}
          マーカーは、Reactが管理する遷移と、Effrontが明示的に開始したドキュメント遷移も除外します。
          特に後者は、フォールバックとして開始したドキュメント読み込みを再びinterceptしないためのものです。
        </p>
        <p>
          <code>browserMain</code> は <code>Effect.scoped</code> と <code>Effect.never</code>{" "}
          でサービスと購読を維持します。
          初期Flightの失敗とhydration開始時のエラーは、ブラウザーの失敗画面につながります。
          React描画中のエラーは、レンダラーのError Boundaryが別に扱います。
        </p>
        <h2 id="flight-load">ルートを取得するか、ブラウザーに処理を戻す</h2>
        <p>
          対象となるイベントを受けると、<code>client/route-loader.ts</code>{" "}
          はまず取得が必要かを判断します。
          履歴をたどる遷移では、移動先の履歴エントリーのIDを使い、キャッシュ済みのツリーを再利用できます。
          それ以外の遷移と、履歴をたどってもキャッシュが見つからない場合は、
          <code>FlightClient.load</code> が <code>Accept: text/x-component</code>{" "}
          を付けてGETを送ります。
          リクエストには専用の応答スコープがあり、初期payloadの復号後も資源を維持しつつ、必要がなくなれば解放できるようにしています。
        </p>
        <p>
          ナビゲーションでは、2xx範囲外の応答やFlight以外のContent-Typeを持つ応答は、描画するツリーではなく{" "}
          <code>Document</code> という結果になります。
          ルーターはその応答を解放し、要求した移動先へのドキュメント遷移を開始します。
          一方、通信の失敗、解決済みの応答URLの欠落や不正、復号の失敗には{" "}
          <code>FlightLoadError</code> を使い、理由をそれぞれ <code>RequestFailed</code>、
          <code>UnexpectedResponse</code>、<code>DecodeFailed</code> として区別します。
          これらのエラーは、意図的にドキュメント読み込みへ切り替える場合とは別の扱いです。
        </p>
        <p>
          Flightの取得に成功すると、復号されたpayloadに加えて <code>completed</code>、
          <code>release</code>、<code>resolvedUrl</code> が得られます。
          遅延データのストリーミング中でもpayloadは利用可能になるため、ルートツリーを得たことは{" "}
          <code>completed</code> の成功を意味しません。
          後述のキャッシュ処理を読むときにも、この違いが重要になります。
        </p>
        <p>
          ツリーを公開する前に、<code>client/client-router.ts</code>{" "}
          は解決済みの移動先を検査します。 originが異なる場合はドキュメント遷移が必要です。
          同じoriginでもURLが変わった場合、履歴をたどる遷移か、precommit
          controllerが使えない状況では、ドキュメントを置き換えます。
          それ以外では、Reactのcommit後にcontrollerを通じてredirectできます。
          要求されたhashを保持するのは、解決済みURLにhashがなく、origin・path・queryが要求したURLと一致するときだけです。
        </p>
        <h2 id="transition-commit">描画の予約とcommitを区別する</h2>
        <p>
          ツリーの準備ができると、ルーターはReactに描画を依頼しますが、その依頼を遷移の完了とは見なしません。
          非同期のTransition Actionが <code>BrowserEffectRunner</code>{" "}
          を通じて読み込み処理を実行し、EffectをネイティブなPromiseの境界につなぎます。
          読み込み後、次の内側のTransitionがツリーを公開します。
        </p>
        <SourceExcerpt source={coreRuntimeSources.navigationPublication} />
        <p>
          <code>browserRenderer.navigate</code>{" "}
          はReactのstate更新を予約し、ライフサイクルを扱う三つの値を返します。
          <code>committed</code> はレンダラーがツリーのcommitを通知すると解決し、
          <code>retired</code>{" "}
          は置き換えのcommitによってそのツリーを保持する必要がなくなると解決します。
          <code>discard</code> は未commitの描画に対して現在のツリーの復元を依頼し、退役を待ちます。
          commitの通知元は <code>client/react-dom-renderer.tsx</code> で、layout effectが{" "}
          <code>browserRenderer.commit(render)</code> を呼びます。
          stateの公開だけでは、この通知にはなりません。
        </p>
        <p>
          キャンセル可能なイベントには、ルーターは <code>precommitHandler</code> を指定して{" "}
          <code>event.intercept</code> を使います。
          <code>committed</code>{" "}
          を待ち、可能なredirectを適用したうえで、ブラウザーの履歴commitを記録するcallbackを{" "}
          <code>addHandler</code> に登録します。
          キャンセル不能な履歴遷移では通常のhandlerを使うため、同じように履歴の確定を遅らせることはできません。
          この経路で準備が失敗すると、ルーターはドキュメントをreloadします。
        </p>
        <p>
          抜粋にあるTransition typeは、遷移の種類と、判別できる場合には進行方向を表します。
          リンクからのpush・replace遷移では <code>data-effront-transition-types</code>{" "}
          の値も追加でき、重複とフレームワークの予約済みtypeは除かれます。
          これらのラベルはReactのTransitionを分類するもので、commitや資源の寿命に関する規則を変えるものではありません。
          アプリケーションでの使い方は、
          <a href="/ja/advanced/client-navigation">クライアントナビゲーションとページ遷移</a>
          を参照してください。
        </p>
        <h2 id="navigation-lifetime">完了したルートを保存し、不要になった描画を退役させる</h2>
        <p>
          最初の移動先を読み込み中、あるいは描画中に、別のリンクをクリックする場合を考えます。
          ルーターは処理中の候補を表示中の遷移と分けて管理し、候補を{" "}
          <code>Loading → Publishing → Rendering</code> の状態で表します。
          各候補はgenerationを表すsymbolとAbortControllerを持つため、新しい遷移は表示中のツリーの資源をすぐに解放せずに、処理中の候補をキャンセルできます。
        </p>
        <p>
          古くなった読み込みがルートを返しても、generationの検査によって、公開せずに解放します。
          すでに描画を予約している場合は、ルーターは <code>discard</code>{" "}
          を呼び、退役を待ってから資源を解放します。
          <code>BrowserRenderer</code>{" "}
          は、表示中のツリーと、復元の依頼を含む保留中の公開から参照されているツリーを保持します。
          このため、遷移をabortすることと、その描画を退役させることは同じ操作ではありません。
          未公開または退役済みのツリーのcommitや、不正なライフサイクル遷移は、内部の不変条件への違反としてTypeErrorになります。
        </p>
        <p>
          新たに取得して表示されたルートをキャッシュするには、履歴エントリーのcommitとFlightの正常完了の両方が必要です。
          どちらが先に届くこともあるため、<code>NavigationEntryState</code> と{" "}
          <code>NavigationFlightState</code> がそれぞれを追跡します。
        </p>
        <ul>
          <li>
            履歴が先にcommitした場合、ルーターはストリームの完了を待ってからキャッシュし、応答を解放します。
          </li>
          <li>
            Flightが先に完了した場合、ルーターは応答を解放し、履歴エントリーが分かるまでキャッシュ用のcallbackを保持します。
          </li>
          <li>ストリームが失敗した場合、ルーターはルートをキャッシュせずに資源を解放します。</li>
        </ul>
        <p>
          描画の退役時にも、すでに新しいgenerationへ進んでいるかどうかにかかわらず資源を解放します。
          キャッシュが保持するのはルートツリーであり、その応答ストリームを開き続ける必要はありません。
          <code>RouteLoader</code>{" "}
          は履歴エントリーのdispose時に対応するキャッシュを削除し、refresh時にはキャッシュのMapを置き換えるため、古い読み込みのcallbackが遅れて実行されても新しいキャッシュに保存できません。
          <a href="/ja/architecture/implementation/server-functions">Server Functionの実行の章</a>
          では、同じレンダラーのライフサイクルを使い、応答によって現在のページを更新する流れを追います。
        </p>
      </>
    ),
  },
  {
    slug: "/architecture/implementation/server-functions",
    title: "07. Server Functionの呼び出しから画面更新まで",
    description:
      "Server FunctionのPOSTを入力検証、リクエスト内での実行、画面更新まで追い、通信エラー・関数の失敗・古い応答を区別します。",
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
          Server
          Functionの呼び出しでは、呼び出し元に返す値と、実行後に描画するページの二つを調整します。
          それぞれの経路を理解すると、関数が失敗してもHTTP
          200が返る理由や、遅れて届いた応答で離れたページを表示してはいけない理由が分かります。
          この章では、一つのPOSTを検証からブラウザーの画面更新まで追います。
          実装の仕組みではなくアプリケーションの書き方を知りたい場合は、
          <a href="/ja/advanced/server-function-execution-and-refresh">実行と画面更新のガイド</a>
          を参照してください。
        </p>
        <h2 id="request-decoding">1. 届いた呼び出しを識別して検証する</h2>
        <p>
          <code>client/call-server.ts</code>
          のブラウザー側コールバックは、現在の履歴entryまたはURLと、単調増加する呼び出し順序を記録します。
          Reactの <code>encodeReply</code> で引数を符号化し、<code>FlightClient</code>{" "}
          を通じてそのURLへPOSTします。
          <code>x-effront-server-fn</code>{" "}
          ヘッダーでactionを指定し、AcceptヘッダーでFlightを要求します。
          サーバーでは、送信先のPOSTルートがリクエストを <code>prepareServerFnRequest</code>{" "}
          に渡します。
        </p>
        <p>
          actionを復号する前に、<code>validateOrigin</code>{" "}
          がOriginを必須とし、解析したURLのhostを小文字化したHostヘッダーと比較します。
          ヘッダーの欠落、OriginのURL解析失敗、不一致は403になります。
          これはhostの比較であり、schemeを含むorigin全体の比較ではありません。
          続いて、リクエストのscopeのAbortSignalを使ってWeb Requestへ変換します。 action
          IDのヘッダーがあればクライアント呼び出しの経路を選びます。
          なければ、JavaScriptなしでも使うprogressive enhancementのフォーム経路へ進みます。
        </p>
        <p>
          どちらの経路でも、実際に読み取ったバイト数を数え、本文が10 MiBを超えたら400で拒否します。
          これはHTTPの入口にあるContent-Lengthの検査とは別です。
          入口の検査では、本文を読む前に413を返す場合があります。 詳しくは
          <a href="/ja/architecture/implementation/request">リクエストの寿命の章</a>
          を参照してください。 読み取った本文は、multipartならFormData、それ以外ならtextになります。
          本文の読み取りやmultipartの解析に失敗した場合も、status 400のリクエストエラーになります。
        </p>
        <SourceExcerpt source={coreRuntimeSources.serverFnDecode} />
        <p>
          クライアント呼び出しでは、<code>decodeReply</code>{" "}
          が配列サイズ上限10,000と一時参照の集合を使ってReactの引数を復元します。
          Effrontは結果が配列であることを確認してから、<code>loadServerAction</code>{" "}
          で関数の参照を解決します。 復号、引数配列の検証、参照解決のエラーは400です。
          この検査が確かめるのは通信上の形式であり、関数のアプリケーション入力Schemaではありません。
          サーバーは一時参照をFlight応答に引き継ぎ、ブラウザーは <code>encodeReply</code>{" "}
          に渡した集合を使ってその応答を復号します。
        </p>
        <h2 id="function-definition">2. Reactの参照から型付きの実行処理を取り出す</h2>
        <p>
          Reactの参照を解決すると関数を特定できますが、Effrontの関数でhandlerを実行するには、対応するアプリケーションサービスとMiddlewareも必要です。
          <code>makeServerFnFactory</code>{" "}
          は、呼び出し時にhandlerをすぐ実行する代わりに、実行すべきEffectの記述を返すことで、その情報を保持します。
        </p>
        <SourceExcerpt source={coreRuntimeSources.serverFnSchema} />
        <p>
          呼び出し元はSchemaのEncodedの値を渡します。 handlerが復号済みのTypeの値を受け取るのは、
          <code>Schema.Tuple</code> が成功した後です。
          単一の入力Schemaは最初の引数だけを復号し、ネイティブな呼び出しの余分な引数を無視します。
          引数が省略された場合はundefinedを復号します。
          Schemaの配列を指定した場合は、位置付きの引数列を検証します。 復号とhandlerは{" "}
          <code>AvailableServices</code> を要求でき、それぞれの型付きの失敗は{" "}
          <code>ServerFnOperationError</code> に包まれます。
        </p>
        <p>
          返されるPromiseには、Effect、アプリケーションidentity、Middlewareを含む内部brandが付いています。
          サーバーグラフで直接awaitするとTypeErrorでrejectします。 HTTPの経路では、代わりに{" "}
          <code>matchServerFnInvocation</code> が実行処理を取り出し、
          <a href="/ja/architecture/implementation/application">アプリケーションidentity</a>
          を検証します。
          別のEFFRONTモジュールで作った関数はidentity不一致であり、そのモジュールのサービスを使えるわけではありません。
          brandのないネイティブなReact Server
          Functionは別の経路を通り、Effrontの関数Middlewareを使わずにEffect内で結果を待ちます。
        </p>
        <h2 id="execution-outcome">3. Middleware内で実行し結果を描画に渡す</h2>
        <p>
          準備処理は、<code>execute</code> と関数のMiddlewareを含む{" "}
          <code>PreparedServerFnRequest</code> を返します。
          <code>server/application.ts</code> の <code>executeServerFnAndRefresh</code>{" "}
          は、実行とその後の描画の両方を関数のMiddlewareで包みます。
          送信先だけが必要とするMiddlewareは描画処理を包み、関数のMiddlewareに含まれるものはそこで二度適用しません。
          rendererには両方を合わせた一覧を渡すため、Runtimeのscope検査でも更新先ページが使えるMiddlewareを確認できます。
        </p>
        <p>
          クライアント呼び出しでは、<code>serverFnOutcome</code> が実行処理のExitを{" "}
          <code>serverFnResult</code> のSuccessの値またはFailureのエラーに変換します。
          どちらもstatus 200で描画へ進むため、HTTPの成功だけでは関数の成功を判断できません。
          割り込みは別扱いです。
          失敗の正規化と結果の処理は、どちらも割り込みをFailureのデータにせず、割り込みのまま保ちます。
          生成する<a href="/ja/architecture/implementation/rendering">Flightのペイロード</a>
          には、ルートツリーと関数の結果を一緒に含めます。
        </p>
        <p>
          progressive
          enhancementのフォーム送信には、確定させるクライアント呼び出しのPromiseがないため、別の結果が必要です。
          multipartのFormDataを必須とし、Reactの <code>decodeAction</code> を使います。
          actionがない、または復号できない場合は400です。 実行後、<code>decodeFormState</code>{" "}
          がSSRとhydrationの両方へ渡す状態を作ります。 成功時はstatus 200、<code>formState</code>、
          <code>serverFnResult: null</code>{" "}
          で描画し、通常のドキュメントとしてのフォーム要求にはHTMLを返します。
          フォーム実行の型付きエラーとフォーム状態の復号エラーは500になります。 POSTルートは{" "}
          <code>ServerFnRequestError</code>{" "}
          を関数結果のペイロードにはせず、指定されたstatusとテキスト応答に変換します。
        </p>
        <h2 id="result-refresh">4. 呼び出し結果を確定してから画面の更新方法を選ぶ</h2>
        <p>
          ブラウザーでは、非2xx応答、Flightではない応答、関数結果の欠落は呼び出しをrejectし、結果に基づく画面更新の経路には進みません。
          有効なSuccessは呼び出し元のPromiseをその値でresolveします。 有効なFailureは{" "}
          <code>ServerFnCallError</code> でrejectします。
          EffrontはPromiseの確定後に継続処理を登録するため、Reactが先に登録したActionの処理が進んでから更新のTransitionを開始します。
          その後、SuccessもFailureも同じ更新判定へ進みます。
          失敗は「画面を変えない」という意味ではありません。
        </p>
        <p>返されたツリーを再利用できるのは、次の条件がすべて保たれている場合だけです。</p>
        <ul>
          <li>応答が、最後に開始した呼び出しに対応している。</li>
          <li>画面遷移のTransitionが進行中ではない。</li>
          <li>
            現在の履歴entryのIDが記録したIDと一致する。
            呼び出し時にentryがなかった場合は、現在もentryがなく、URLが変わっていない。
          </li>
        </ul>
        <p>
          既存のルート更新をinterruptした後にも、Effrontは条件を再確認します。
          後片付けの間に、別の呼び出しや遷移が先へ進む可能性があるためです。
          応答が使えなくなっていれば、その資源を解放し、代わりに{" "}
          <code>RouteRefresher.refreshCurrentRoute("server-function")</code> を呼びます。
          この経路は遷移が落ち着くのを待ち、新たなルート遷移と更新を競合させます。
          古い応答を無条件に画面へ反映するわけではありません。
        </p>
        <p>
          応答を再利用できる場合は、<code>RouteLoader.prepareRefresh</code> がキャッシュを無効化し、
          <code>startTransition</code> の中でTransition typeを <code>server-function</code>{" "}
          として新しいツリーを公開します。 公開処理のcommit Promiseを、このTransition
          Actionの戻り値にはしません。 そこで待つと、待機対象であるcommit自体を妨げるためです。
          別のscope付きFiberが応答の完了とReactのcommitの両方を待ってからキャッシュを保存します。
          先に公開がretireされた場合は待機を終了し、どちらの場合も後片付けで応答の資源を解放します。
          この所有権を<a href="/ja/architecture/implementation/navigation">画面遷移</a>
          と比較するか、
          <a href="/ja/architecture/implementation/overview">実装の全体図</a>
          に戻ると、リクエストからブラウザーまでの流れの中に、この呼び出しを位置付けられます。
        </p>
      </>
    ),
  },
];
