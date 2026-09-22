A Server Function's return value supplies form feedback.
The refreshed Page shows the saved data.

## One call returns a result and a refreshed page {#execution}

For a settings form, Effront processes the save in this order:

1. The Server Function handler writes the settings.
2. The Page reads the saved settings when Effront rerenders the route.
3. One response carries both the function result and the refreshed page.

The submit handler does not need a second refresh request.
Without JavaScript, a successful native form submission returns a complete HTML page with React's form state.
Pass the Server Function directly to the form or `useActionState`, as in the [Server Functions guide](/en/guide/server-functions).

## The result can arrive before the view {#result-and-refresh}

The browser call's Promise settles before Effront applies the refreshed page.
A form can show “Settings saved” while the rest of the screen still updates.
Neither `await` nor the end of the pending state guarantees that new DOM elements exist.
Wait for the refreshed component to render before you focus or measure those elements.

<span id="input-boundary"></span>

Return expected failures as [form state](/en/guide/server-functions#state).
[Input Schema and uncaught handler failures](/en/api-reference/server-functions#arguments) reject the invocation instead.

## Refresh ordering is not write ordering {#concurrency}

Independent browser calls can overlap.
React's [`useActionState`](https://react.dev/reference/react/useActionState) queues calls dispatched through the same hook.

When the user leaves before a browser call returns its result, Effront refreshes the current route.
The response cannot force the previous page back into view.

If save B starts after save A, a late A response cannot directly install its bundled page.
Save A can still change the database after B.
Use server-side version checks or transactions to enforce the application's write-order rules.

A lost response does not prove that the write was rolled back.
Use duplicate detection for writes that may be retried.
