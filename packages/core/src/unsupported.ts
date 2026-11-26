// oxlint-disable-next-line unicorn/require-module-specifiers -- Explicitly mark this side-effect-only package entry as an ES module.
export {};

// oxlint-disable-next-line rules/require-tagged-error -- The package entry throws a native TypeError when imported outside React Server Components.
throw new TypeError(
  'The "@effront/core" package can only be imported in a React Server Components environment.',
);
