import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dbConnect } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/jobs", jobRoutes);
app.use("/applications", applicationRoutes);

const PORT = process.env.PORT || 5000;

// Start server WITHOUT waiting for DB
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Connect to DB after server starts
  dbConnect()
    .then(() => console.log("✅ Database ready"))
    .catch((err) =>
      console.error("❌ Database connection failed:", err.message)
    );
});
