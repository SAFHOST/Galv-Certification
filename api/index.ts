import { createExpressApp } from '../src/serverApp';

const app = createExpressApp();

export default function handler(req: any, res: any) {
  // If Vercel rewrites stripped the /api prefix, prepend it so Express /api router matches seamlessly
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
  return app(req, res);
}
