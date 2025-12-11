import express from "express";
import {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  publishJob,
  getPublishedJobs,
  getJobStats,
  getAdminDashboard,
} from "../controllers/jobController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// PUBLIC ROUTES - Anyone can view published jobs
router.get("/published", getPublishedJobs);
router.get("/published/:id", getJobById);

// PROTECTED ROUTES - HR & ADMIN ONLY
router.post("/", protect, authorizeRoles("admin", "hr"), createJob);
router.get("/", protect, authorizeRoles("admin", "hr"), getAllJobs);
router.get("/stats", protect, authorizeRoles("admin", "hr"), getJobStats);
router.get("/:id", protect, authorizeRoles("admin", "hr"), getJobById);
router.put("/:id", protect, authorizeRoles("admin", "hr"), updateJob);
router.delete("/:id", protect, authorizeRoles("admin", "hr"), deleteJob);
router.patch(
  "/:id/publish",
  protect,
  authorizeRoles("admin", "hr"),
  publishJob
);
router.get(
  "/admin/dashboard",
  protect,
  authorizeRoles("admin"),
  getAdminDashboard
);

export default router;
