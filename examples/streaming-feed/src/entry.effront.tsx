import { Effect } from "effect";
import { EFFRONT } from "./effront.ts";
import { Feed } from "./feed.tsx";
import { storiesAfter, storyCount } from "./feed-data.ts";

const initialCursor = 0;
const siteNavigation = (
  <header>
    <a href="/">Fieldnotes</a> <a href="/about">About</a>
  </header>
);

const Layout = EFFRONT.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang="en">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Fieldnotes</title>
        </head>
        <body>
          {siteNavigation}
          <main>{children}</main>
        </body>
      </html>,
    ),
});

const Home = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <>
        <h1>Fieldnotes</h1>
        <p>Showing the first six of {storyCount.toLocaleString("en-US")} fictional notes.</p>
        <Feed seed={storiesAfter(initialCursor)} />
      </>,
    ),
});

const About = EFFRONT.Page.make({
  render: () =>
    Effect.succeed(
      <>
        <h1>About this feed</h1>
        <p>The notes are fictional and generated locally.</p>
        <a href="/">Back to the feed</a>
      </>,
    ),
});

const application = EFFRONT.make({
  routes: EFFRONT.Routes.make({ layout: Layout }).page("/", Home).page("/about", About),
});

// oxlint-disable-next-line import/no-default-export -- The Effront Vite plugin loads its application from this entry’s default export.
export default application;
