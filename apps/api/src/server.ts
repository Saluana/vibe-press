import dotenv from "dotenv";
import express, { Request, Response } from "express";
import pg from "pg";
import AuthRouter from "@vp/server/rest/auth";
import UserRouter from "@vp/server/rest/users";
import PostRouter from "@vp/server/rest/posts";
import { requireCapabilities } from "@vp/server/middleware/verifyRoles.middleware";
// --- NEW: import & boot plugin manager
import { PluginManager } from "@vp/core/plugins/manager";
import {serverHooks} from "@vp/core/hooks/hookEngine.server";

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

// Express app
const app = express();
app.use(express.json());

// --- NEW: initialize plugins
(async () => {
  serverHooks.doAction('server:starting')
  const pluginManager = new PluginManager();
  try {
    await pluginManager.init();
    console.log("✅ Plugins initialized");
  } catch (err) {
    console.error("❌ Failed to initialize plugins", err);
    process.exit(1);
  }

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // DB test
  app.get(
    "/db-test",
    requireCapabilities(["read", "manage_options"]),
    async (_req: Request, res: Response) => {
      try {
        const result = await pool.query("SELECT NOW() AS now");
        res.json({ now: result.rows[0].now });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
      }
    }
  );

  // mount your core REST routes
  app.use("/wp-json/wp/v2/", AuthRouter);
  app.use("/wp-json/wp/v2/", UserRouter);
  app.use("/wp-json/wp/v2/", PostRouter);

  // start listening
  const port = parseInt(process.env.PORT || "4000", 10);
  app.listen(port, () => {
    console.log(`🚀 API server listening on port ${port}`);

    serverHooks.doAction('server:started', { port })
  });
})();
