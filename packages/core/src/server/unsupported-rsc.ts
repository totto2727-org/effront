const unsupported = (): never => {
  throw new TypeError(
    "Effront rendering and Server Function decoding require the react-server compilation graph. Configure the Effront Vite plugin before invoking RSC operations.",
  );
};

export {
  unsupported as createTemporaryReferenceSet,
  unsupported as decodeAction,
  unsupported as decodeFormState,
  unsupported as decodeReply,
  unsupported as loadServerAction,
  unsupported as renderToReadableStream,
};
