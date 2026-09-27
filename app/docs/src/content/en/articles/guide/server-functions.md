Server Functions validate input and run handlers on the server. Choose a guide based on whether the call refreshes the page and how many values it returns.

## Choose a call {#choose}

| Need                                                         | Call                    | Guide                                                      |
| ------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------- |
| Submit a form or refresh the current route after a change    | Standard mutation       | [Mutation Server Function](./mutation-server-functions.md) |
| Read one value without refreshing the current route          | `query` / `queryAtom`   | [Query Server Function](./query-server-functions.md)       |
| Read progressive values without refreshing the current route | `stream` / `streamAtom` | [Stream Server Function](./stream-server-functions.md)     |
