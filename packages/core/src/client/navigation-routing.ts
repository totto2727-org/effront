import { Predicate, String } from "effect";

const ReactTransitionNavigationInfo = "react-transition";

export const NativeDocumentNavigationInfo = "effront-native-document";

type NavigationInputs = Pick<
  NavigateEvent,
  "canIntercept" | "downloadRequest" | "formData" | "hashChange" | "info" | "navigationType"
>;

export const isRoutedNavigation = (event: NavigationInputs): boolean =>
  event.canIntercept &&
  !event.hashChange &&
  // oxlint-disable-next-line rules/prefer-is-nullish -- A native NavigateEvent represents no download with an explicit null.
  Predicate.isNull(event.downloadRequest) &&
  // oxlint-disable-next-line rules/prefer-is-nullish -- Route navigation accepts the native null for absent form data.
  Predicate.isNull(event.formData) &&
  event.info !== ReactTransitionNavigationInfo &&
  event.info !== NativeDocumentNavigationInfo &&
  event.navigationType !== "reload";

export const preserveRequestedHash = (requested: URL, resolved: URL): URL =>
  String.isEmpty(resolved.hash) &&
  resolved.origin === requested.origin &&
  resolved.pathname === requested.pathname &&
  resolved.search === requested.search
    ? new URL(`${resolved.href}${requested.hash}`)
    : resolved;
