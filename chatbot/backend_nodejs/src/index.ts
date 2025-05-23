import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import agentRoutes from "./routes/agentRoutes"; // Import agent routes

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies

// Basic route
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Chatbot Backend API",
    version: "1.0.0",
    endpoints: {
      agent: "/api/agent/execute",
    },
  });
});

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Use agent routes
app.use("/api/agent", agentRoutes); // Mount agent routes under /api/agent

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `Zapier MCP URL: ${process.env.ZAPIER_MCP_ENDPOINT_URL || "Not configured"}`,
  );
});
