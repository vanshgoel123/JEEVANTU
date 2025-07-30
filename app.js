const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Added CORS middleware
require("dotenv").config();
const path = require('path');


const { registerRoutes } = require("./routes");
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB Atlas:", err);
  });

const app = express();

// Enable CORS for your frontend
app.use(
  cors({
    origin: true, // Adjust if needed
    credentials: true,
  })
);

// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '50mb' })); // Increase limit to 10MB
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Also increase for URL-encoded data


// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  // Serve frontend (Vite build from frontend-dist/)
    const frontendPath = path.join(__dirname, "Frontend","dist");
    app.use(express.static(frontendPath));
  
    // Handle SPA routes (React/Vite fallback)
    app.get("*", (req, res) => {
      res.sendFile(path.join(frontendPath, "index.html"));
    });

  // Global error handler
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  server.listen(process.env.PORT || 5000, "0.0.0.0", () => {
    console.log(`serving on port ${process.env.PORT || 5000}`);
  });
})();
