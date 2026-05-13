require("dotenv").config();

const express = require("express");
const cors = require("cors");

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

// ================= DEBUG LOGS =================
console.log("SUPABASE URL:", process.env.SUPABASE_URL || "Missing");

console.log(
  "SERVICE KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "Loaded" : "Missing",
);

console.log(
  "OPENROUTER KEY:",
  process.env.OPENROUTER_API_KEY ? "Loaded" : "Missing",
);

// ✅ Vonage Logs
console.log(
  "VONAGE API KEY:",
  process.env.VONAGE_API_KEY ? "Loaded" : "Missing",
);

console.log(
  "VONAGE API SECRET:",
  process.env.VONAGE_API_SECRET ? "Loaded" : "Missing",
);

console.log("VONAGE BRAND:", process.env.VONAGE_BRAND_NAME || "Missing");
// ================= BODY PARSER =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("🚀 CARAPP Backend Running...");
});

// ================= ROUTES =================
app.use("/api/auth", authRouter);
app.use("/users", userRouter);
app.use("/api/reports", reportRouter);
app.use("/api/vehicles", vehicleRouter);
app.use("/api/ai", aiRouter);

// Gamification
app.use("/api/gamification", gamificationRouter);

// ✅ FIXED SMS ROUTE
app.use("/api/test-sms", testSmsRouter);

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
