import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { healthCheck } from "../backend-api";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path, input, ctx, req }) {
        console.error('[tRPC Error]', {
          type,
          path,
          code: error.code,
          message: error.message,
          cause: error.cause,
        });
        
        // Log backend API call details if available
        if (error.cause && typeof error.cause === 'object') {
          const cause = error.cause as any;
          if (cause.url) {
            console.error('[tRPC Error] Backend URL:', cause.url);
          }
          if (cause.status) {
            console.error('[tRPC Error] Backend Status:', cause.status);
          }
        }
      },
      responseMeta({ ctx, paths, errors, type }) {
        // Ensure errors are returned as JSON
        return {
          headers: {
            'Content-Type': 'application/json',
          },
        };
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, async () => {
    console.log('='.repeat(60));
    console.log(`✓ ops-frontend Server running on http://localhost:${port}/`);
    console.log('='.repeat(60));
    console.log('Architecture: Vite middleware mode (integrated with Express)');
    console.log(`tRPC endpoint: http://localhost:${port}/api/trpc`);
    console.log(`OAuth callback: http://localhost:${port}/api/oauth/callback`);
    console.log('Frontend: Vite HMR enabled');
    console.log('='.repeat(60));
    
    // Backend API health check
    await healthCheck();
    console.log('='.repeat(60));
  });
}

startServer().catch(console.error);
