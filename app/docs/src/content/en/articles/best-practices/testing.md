## Test a persisted change in the browser {#pages}

For a profile editor, test the complete save flow with an isolated test account and data store:

1. Open the profile URL directly and check its initial name.
2. Enter a different name and submit the form.
3. Check both the submission feedback and the updated name on the page.
4. Reload and check that the saved name remains.

Checking after reload distinguishes a stored change from local UI state.
Also reach the page through an application link and Back/Forward navigation, asserting that the URL and displayed data agree.
Keep a rejected-update case that checks the error feedback and confirms the stored data did not change.

## Test rules below the Server Function {#services}

Put shared business logic in functions or Effect services that Pages and Server Functions call, then test those functions or services directly.
An Effront Server Function cannot be invoked as an ordinary function in the server graph.
Keep its [form submission](/en/guide/server-functions) in the browser test to exercise the request and rendering path.

Use smaller tests for blank names, unauthorized edits, and failed writes.
Assert the result and stored state, not only whether the function succeeded.
For authorization, submit a record ID the caller does not own and verify rejection on the server.
A hidden or disabled edit button does not test that boundary.

An Effect Layer can supply predictable service responses and failures, as described in [Effect Layers](https://effect.website/docs/requirements-management/layers/) and [Effront services](/en/guide/effect).
A test double does not verify the real database or external API adapter, so cover that adapter separately with an integration test against a test instance.

## Verify the release artifact {#production}

Run the important journey against the built application in its target runtime, using test data and credentials.
Use the host's production entry point from [Platforms](../platforms.md#build-startup), not a development server or a preview in a different runtime.

Include checks for the boundaries the application uses:

- **Direct entry:** the requested page delivers HTML, CSS, and images, and becomes interactive after JavaScript loads.
- **Missing resources:** unknown page and asset URLs return the expected 404 responses.
- **Progressive forms:** Server Function forms submit and display the resulting page with JavaScript disabled.
- **Streaming:** delayed content completes, and navigating away before it completes leaves the chosen destination visible.
- **Browser fallback:** in supported browsers without the Navigation API, links work through full-document navigation.
- **Secret handling:** recognizable synthetic server secrets are absent from HTML and Flight responses. Never use real credentials as test markers.

## Isolate data and automate startup {#tools}

Give each test a known initial state and separate records so concurrent tests cannot overwrite one another's data.
[Playwright](https://playwright.dev/docs/intro) can drive the browser and manage application startup and shutdown through [webServer](https://playwright.dev/docs/test-webserver).
A runner such as [Vitest](https://vitest.dev/guide/) can cover isolated logic.

Keep input combinations in the smaller tests and browser coverage focused on complete journeys and integration failures.
For a regression, add the smallest test that detects the failure and rerun the affected browser journey.
