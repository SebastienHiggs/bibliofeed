// The only code that runs on Cloudflare: the old *.workers.dev address sends
// people to bibliofeed.net; every other request is answered from dist/ by the
// static assets binding, exactly as before. Preview builds live on
// <version>-bibliofeed.sebastienjhiggs.workers.dev and don't match, so they
// keep working. See wrangler.jsonc.
const OLD_HOST = 'bibliofeed.sebastienjhiggs.workers.dev';
const SITE = 'bibliofeed.net';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === OLD_HOST) {
      url.hostname = SITE;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
