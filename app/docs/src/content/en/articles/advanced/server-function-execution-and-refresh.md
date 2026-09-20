A Server Function's result and its refreshed page arrive through the same response, but they do not become available to the UI at the same time.
Refresh ordering also does not determine the order of database writes.

## One call returns a result and a refreshed page {#execution}

After executing a Server Function, Effront rerenders the requested route.
A browser call receives both the function result and the refreshed page, so the submit handler does not need a second refresh request.
For a settings editor, the handler completes the write, the Page reads the saved settings, and the return value supplies feedback such as “Settings saved.”

A successful native form submission before JavaScript loads returns a complete HTML page with React's form state instead.
This requires passing the Server Function reference directly to the form or `useActionState`, as shown in the [Server Functions guide](/en/guide/server-functions).

## Validation is not authorization {#input-boundary}

`EFFRONT.ServerFn.make` decodes arguments with its input Schema before invoking the handler.
Schema decoding checks the input, not the caller's permission to change a record.
Authentication and authorization belong in the handler or [Middleware](/en/guide/middleware) applied to that Server Function, before the write.
Protecting only the Page that displays the form is insufficient.
Record IDs, hidden fields, and previous form state remain untrusted input.

Server Function bodies are limited to 10 MiB, and React's browser-call argument decoder limits array sizes to 10,000.
Large files need a separate upload path.
Protocol rejection is distinct from application authorization:

- A missing or invalid `Origin`, or an origin URL whose host does not match `Host`, produces 403.
- Arguments or forms that cannot be decoded as React's protocol produce 400.
- An oversized `Content-Length` detected at the HTTP entry point produces 413. Exceeding the limit while reading a Server Function body produces 400.

## The result can arrive before the view {#result-and-refresh}

The browser call's Promise resolves or rejects when the function result is received, before Effront applies the refreshed page.
The form can therefore show “Settings saved” while other content is still updating.
Neither completion of `await` nor the end of the form's pending state guarantees that updated DOM elements exist.
Focus or measurement of those elements must wait for their component to render.

Expected business failures can be returned as state for `useActionState`, as in the [stateful form example](/en/guide/server-functions#state).
Input Schema failures happen before the handler runs and are not automatically converted to form state.
They reject the browser call, as do handler failures left in the error channel.
When React invokes the function as an Action, these rejections reach React's error handling.

A refreshed page can keep streaming after its first visible update.
Replacing that view releases its remaining communication, and a client disconnect can interrupt unfinished server work.
A lost response does not prove that a completed write was rolled back, so retrying a write may repeat it.

## Refresh ordering is not write ordering {#concurrency}

Browser calls can overlap.
Effront adopts the page bundled with a response only when all three conditions hold:

- The response belongs to the most recently started call.
- The originating history entry is still current. Without the Navigation API, the original and current URLs are compared instead.
- No navigation is in progress.

Otherwise, Effront discards the bundled page and refreshes the current route after any ongoing navigation settles.
A response from a page the user has left cannot force that page back into view.
Refresh handling invalidates the back/forward page cache, including when a valid response contains a failed function result.

Starting save B after save A prevents a late A response from directly installing its bundled page, but does not prevent A from changing the database.
Disabling a pending form's submit button reduces repeated submissions, but cannot protect against retries or other tabs.
Duplicate detection, version checks, and transactions must enforce the application's write guarantees on the server.
