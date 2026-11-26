import { Context, Effect, Layer } from "effect";

type NavigateListener = (event: NavigateEvent) => void;

const browser: Readonly<{ navigation?: Navigation }> = globalThis;

const navigationApi = {
  getCurrentEntry: () =>
    // oxlint-disable-next-line unicorn/no-null -- Use the native currentEntry absence value in older browsers as well.
    browser.navigation?.currentEntry ?? null,
  getCurrentUrl: () => globalThis.location.href,
  getTransition: () =>
    // oxlint-disable-next-line unicorn/no-null -- Use the native transition absence value in older browsers as well.
    browser.navigation?.transition ?? null,
  navigate: (url: string | URL, options?: NavigationNavigateOptions) =>
    globalThis.navigation.navigate(url, options),
  reloadDocument: () => {
    globalThis.location.reload();
  },
  replaceDocument: (url: string) => {
    globalThis.location.replace(url);
  },
  subscribe: (listener: NavigateListener) => {
    const { navigation } = browser;
    navigation?.addEventListener("navigate", listener);
    return () => {
      navigation?.removeEventListener("navigate", listener);
    };
  },
};

export class NavigationApi extends Context.Service<NavigationApi>()(
  "effront/client/NavigationApi",
  { make: Effect.succeed(navigationApi) },
) {
  // oxlint-disable-next-line rules/no-readonly -- The shared layer reference is fixed for this service.
  public static readonly layer = Layer.effect(this, this.make);

  // oxlint-disable-next-line rules/no-readonly -- Preserve the fixed reference used by test layers.
  public static readonly layerTest = Layer.mock(this);
}
