require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRouter = require("./Routes/AuthRoutes");
const userRouter = require("./Routes/UserRoutes");
const reportRouter = require("./Routes/ReportRoutes");
const vehicleRouter = require("./Routes/VehicleRoutes");
const aiRouter = require("./Routes/AiRoutes");

console.log("SUPABASE URL:", process.env.SUPABASE_URL);
console.log(
  "SERVICE KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "Loaded" : "Missing",
);
console.log(
  "OPENROUTER KEY:",
  process.env.OPENROUTER_API_KEY ? "Loaded" : "Missing",
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("🚀 CARAPP Backend Running...");
});

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/api/reports", reportRouter);
app.use("/api/vehicles", vehicleRouter);
app.use("/api/ai", aiRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});