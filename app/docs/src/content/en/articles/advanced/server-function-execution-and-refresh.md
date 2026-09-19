A save action needs to update stored data and give the user useful feedback without making them reload the page.
Effront connects a Server Function call to a page refresh, but the function result, rendered view, and database write guarantees are different parts of that workflow.
Use this guide to decide what your handler should return, when the UI can use it, and how to keep repeated submissions safe.

## Build a save-and-refresh flow {#execution}

Start with a Server Function defined through `EFFRONT.ServerFn.make` and a Page that reads the data it changes.
The [Server Functions guide](/en/guide/server-functions) shows the definitions and form wiring.
For a settings editor, divide the work as follows:

1. The handler validates the operation and completes the settings write before returning.
2. The Page reads the stored settings when Effront rerenders it after the call.
3. The form uses the function's return value for operation-specific feedback, such as a confirmation message.

This keeps the saved data as the source for the refreshed page instead of requiring the browser to reconstruct the server-rendered view.
Effront performs the rerender as part of handling the call, so you do not need to add a second refresh request to the submit handler.

With React running in the browser, the response carries both the function result and the refreshed page.
For a native form submission before JavaScript loads, a successful call returns a complete HTML page with React's form state.
Pass the Server Function reference directly to the form or `useActionState` as shown in the basic guide to preserve that form behavior.

## Protect the write before exposing the form {#input-boundary}

`EFFRONT.ServerFn.make` decodes incoming arguments with its input Schema before invoking the handler.
That checks the input's shape, not whether the caller may change a particular record.
Authenticate the caller and check permission for the requested operation in [Middleware](/en/guide/middleware) or the handler before writing data.
Treat record IDs, hidden fields, and previous form state as untrusted input even when your own UI supplied them.

Choose input limits that fit the operation and let the user correct an oversized submission.
Server Function bodies have a 10 MiB limit, and React's argument decoder limits array sizes to 10,000.
Provide a separate upload path for large files rather than placing them in an ordinary Server Function submission.

When diagnosing a rejected request, distinguish protocol checks from application authorization:

- A missing `Origin`, or an origin URL whose host does not match the `Host` header, produces 403.
- Arguments or forms that cannot be decoded as React's protocol produce 400.
- An oversized `Content-Length` detected at the HTTP entry point produces 413, while a body that exceeds the limit during Server Function reading produces 400.

Passing these checks does not grant the caller permission to perform the write.

## Give feedback without waiting for the whole page {#result-and-refresh}

For browser calls, use the returned Promise to observe the function result.
It resolves or rejects when that result is received, before Effront finishes applying the refreshed page.
For example, the form may show “Settings saved” while another part of the page is still receiving updated content.
This is a normal separation between operation feedback and page rendering.

For expected business failures that belong beside the form, return an explicit state value from the handler and display it with `useActionState`.
See the [stateful form example](/en/guide/server-functions#state) for the wiring.
Input Schema decoding failures occur before the handler runs, so they are not automatically converted to that state.
Those failures, and handler failures left in the error channel, reject the browser call and reach React's error handling.

Do not use completion of `await` or the end of the form's pending state as proof that updated DOM elements exist.
If you need to focus or measure an element in the refreshed view, do so when that component has rendered.
The page can also keep streaming after its first visible update.

When another view replaces the streamed update, Effront releases its remaining communication.
Server work follows the request lifetime too: a disconnected client is not a guarantee that unfinished work will continue.
Nor does a lost response prove that a completed write was rolled back.
Design retries with that uncertainty in mind.

## Handle repeated saves safely {#concurrency}

Calls made after React is ready can overlap.
Effront protects the displayed page from outdated responses, but that protection does not serialize the writes themselves.
For example, starting save B after save A prevents a late A response from directly installing its bundled page, not from having changed the database.

Effront adopts the page bundled with a response only if it belongs to the most recently started call, the originating history entry is still current, and no navigation is in progress.
Without the Navigation API, it compares the original and current URLs instead of history entries.
Otherwise, it discards the bundled page and fetches the current route once any ongoing navigation settles.
A response from a page you have left therefore does not force that page back into view.

Refresh handling invalidates the back/forward page cache.
It also runs when a valid response contains a failed function result, so a rejected call does not imply that the view and cache stay unchanged.

For a form where repeated submission is unwanted, disable its submit button while the submission is pending.
Still enforce write safety on the server because retries and other tabs can bypass that UI restriction.
Use duplicate detection for operations that must not run twice, version checks for edits that must not overwrite newer data, and transactions where several writes must succeed together.
Effront's refresh ordering supplies none of those database guarantees.
