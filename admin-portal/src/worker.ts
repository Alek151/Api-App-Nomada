export default {
  async fetch(request: Request, env: { ASSETS: { fetch: (input: Request) => Promise<Response> } }): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
