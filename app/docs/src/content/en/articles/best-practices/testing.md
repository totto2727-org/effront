A useful test tells you whether a change has broken something your users need to do.
Start with a concrete outcome, such as “an account owner can change their display name and see the saved name on their profile,” rather than a list of components to exercise.
This article describes a general testing approach for an Effront application: establish that outcome in a browser, cover the underlying rules separately, and check the same journey against the build you intend to release.

## Start with one user journey {#pages}

Choose a feature whose failure would matter to your users, and write down its starting state and expected result.
For a profile editor, prepare a test account with a known display name and use an isolated test data store so that the test cannot modify production records.
Then exercise the running application in a real browser:

1. Open the profile URL directly and check the current name.
2. Enter a different name in the form and submit it.
3. Check the result shown to the user and the updated name on the page.
4. Reload the page and check that the saved name is still displayed.

The final step distinguishes a persistent update from a change that appeared only in local UI state.
Also reach the profile through an application link and the browser's Back and Forward buttons, checking that the URL and displayed data agree.
These checks cover the connections between a page, a form, and the server that testing a function alone would miss.

## Cover business rules without the browser {#services}

Once the journey is clear, identify the rules that need more input combinations than the browser test should carry.
For the profile editor, these might include rejecting a blank name, refusing changes to someone else's account, and leaving the existing name intact when an update fails.
Test the outcome and stored state for each case, not just whether a function returned successfully.

Put shared business logic in functions or Effect services that a Page or Server Function can call.
Test those functions or services directly.
An Effront Server Function itself cannot be called as an ordinary function in the server graph.
Keep form submission in the browser test so that the real request and rendering path remains covered.
See [Server Functions](/en/guide/server-functions) for the form integration contract.

When the logic depends on an Effect service, supply a test implementation through a Layer to make inputs, responses, and failures predictable.
The [Effect Layers guide](https://effect.website/docs/requirements-management/layers/) explains this dependency mechanism, and the [services guide](/en/guide/effect) explains how services connect to an Effront application.
A test double checks how your logic handles that implementation, not whether your real database or external API integration works.
Keep a separate integration check for the actual dependency where that behavior matters.

Retain a browser case for a rejected update as well: the user should receive the intended feedback and the data should remain unchanged.
Authorization must be enforced on the server, because users can change submitted values, including hidden fields.
A hidden or disabled edit button is not an authorization test.

## Check the release build in its target runtime {#production}

Repeat the important journey with the application built for your chosen host before releasing it.
Use the host's production entry point and runtime, with test data and test credentials rather than production records or secrets.
See [Platforms](../platforms.md#build-startup) for build output and startup instructions.
A successful development session, or a preview running in a different environment, is not evidence that host-specific APIs work in that runtime.

While running that journey, check that directly opening the URL delivers the required HTML, CSS, and images, and that the page remains interactive after JavaScript loads.
Check unknown page and asset URLs for the expected 404 responses.
To check for accidental disclosure, use recognizable synthetic values for server-side secrets and assert that they are absent from the HTML and Flight responses returned to the browser.
Do not use real credentials as test markers.

Extend the journey for the features and browser support you promise.
For a form connected to a Server Function, test submission and the resulting page with JavaScript disabled.
For a Suspense-based loading state, test both completion and navigating away while the content is still loading.
If you support browsers without the Navigation API, repeat link navigation there to check the full-page fallback.

## Make the checks repeatable {#tools}

Automate the journey and rule checks once their expected outcomes are explicit.
[Playwright](https://playwright.dev/docs/intro) can drive the browser, while a runner such as [Vitest](https://vitest.dev/guide/) can run the isolated logic tests.
Playwright's [webServer configuration](https://playwright.dev/docs/test-webserver) can start the application as part of the test run.

Give each test a known initial state and prevent concurrent tests from overwriting one another's data.
Use the smaller logic tests to cover many rule combinations, while keeping browser tests focused on the journeys and integration failures that matter to users.
When a bug escapes those checks, add a regression test at the boundary that would have detected it, then verify that the original user journey still succeeds.
