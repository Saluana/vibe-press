import dotenv from "dotenv";
import express, { Request, Response } from "express";
import pg from "pg";
import AuthRouter from "./api/rest/auth";
import UserRouter from "./api/rest/users";
import './core/plugins/banned-names';
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

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// DB test endpoint
app.get("/db-test", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ now: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Auth endpoints
app.use("/wp-json/wp/v2/", AuthRouter);

// User endpoints
app.use("/wp-json/wp/v2/", UserRouter);

// Start server
const port = parseInt(process.env.PORT || "4000", 10);
app.listen(port, () => {
  console.log(`🚀 API server listening on port ${port}`);
});
