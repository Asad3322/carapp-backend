require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

// Routes
const authRouter = require("./Routes/AuthRoutes");
const userRouter = require("./Routes/UserRoutes");
const reportRouter = require("./Routes/ReportRoutes");
const vehicleRouter = require("./Routes/VehicleRoutes");
const aiRouter = require("./Routes/AiRoutes");
const testSmsRouter = require("./Routes/testSmsRoute");
const gamificationRouter = require("./Routes/gamificationRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ================= CORS =================
const allowedOrigins = [
  "http://localhost:5173",
  "https://car-app-french.vercel.app",
  "https://mediumaquamarine-partridge-790064.hostingersite.com",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ Blocked Origin:", origin);
      return callback(new Error(`CORS not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-owner-access-token",
      "owner-access-token",
    ],
  })
);

// Handle preflight requests
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// ================= BODY PARSER =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= DEBUG LOGS =================
console.log("SUPABASE URL:", process.env.SUPABASE_URL || "Missing");

console.log(
  "SERVICE KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "Loaded" : "Missing"
);

console.log(
  "OPENROUTER KEY:",
  process.env.OPENROUTER_API_KEY ? "Loaded" : "Missing"
);

console.log(
  "VONAGE API KEY:",
  process.env.VONAGE_API_KEY ? "Loaded" : "Missing"
);

console.log(
  "VONAGE API SECRET:",
  process.env.VONAGE_API_SECRET ? "Loaded" : "Missing"
);

console.log("VONAGE BRAND:", process.env.VONAGE_BRAND_NAME || "Missing");

// ================= ROOT HEALTH CHECK =================
// Old backend health check preserved
app.get("/api/health", (req, res) => {
  res.send("🚀 CARAPP Backend Running...");
});

// ================= API ROUTES =================
app.use("/api/auth", authRouter);
app.use("/users", userRouter);
app.use("/api/reports", reportRouter);
app.use("/api/vehicles", vehicleRouter);
app.use("/api/ai", aiRouter);
app.use("/api/gamification", gamificationRouter);
app.use("/api/test-sms", testSmsRouter);

// ================= FRONTEND BUILD =================
// This only serves React build. API routes above remain unchanged.
app.use(express.static(path.join(__dirname, "public")));

// React Router fallback, but do not catch API routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/users")) {
    return next();
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= 404 =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);

  if (err.message && err.message.startsWith("CORS not allowed")) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// ================= SERVER START =================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});