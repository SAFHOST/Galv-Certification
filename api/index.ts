import type { VercelRequest, VercelResponse } from '@vercel/node';

let app: any = null;
let bootError: { message: string; stack?: string } | null = null;

try {
  // Dynamic import to handle both dev and bundled production paths
  const serverModule: any = await import('../src/serverApp.js').catch(() => import('../src/serverApp'));
  
  // Robust check for the factory function
  const createExpressApp = serverModule.createExpressApp || serverModule.default;
  
  if (typeof createExpressApp === 'function') {
    app = createExpressApp();
  } else if (typeof serverModule.default === 'function') {
     app = serverModule.default();
  } else {
    throw new Error('Could not find createExpressApp factory function in serverApp');
  }
} catch (error: any) {
  bootError = {
    message: error?.message || 'Failed to initialize server application',
    stack: error?.stack,
  };
  console.error("BOOT INITIALIZATION ERROR:", error);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (bootError) {
    return res.status(500).json({
      success: false,
      error: "SERVERLESS_BOOT_CRASH",
      message: bootError.message,
      stack: bootError.stack,
    });
  }

  // Prepend /api if missing to match Express routes
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }

  if (typeof app === 'function') {
    return app(req, res);
  }

  return res.status(500).json({
    success: false,
    error: "APP_NOT_INITIALIZED",
    message: "The Express application failed to initialize correctly."
  });
}

