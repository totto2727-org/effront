const worker = { fetch: (): Response => new Response("ok") };

// oxlint-disable-next-line import/no-default-export -- The Cloudflare module Worker fixture loads its handler from the default export.
export default worker;
