import express from "express";
import multer from "multer";
import {
  applyForJob,
  getMyApplications,
  getAllApplications,
  getApplicationsByJob,
  getApplicationById,
  downloadResume,
  updateApplicationStatus,
  withdrawApplication,
  deleteApplication,
  getApplicationStats,
} from "../controllers/applicationController.js";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX allowed"), false);
    }
  },
});

/**
 * Applicant routes
 */
router.post("/apply/:jobId", protect, upload.single("resume"), applyForJob);

router.get("/my-applications", protect, getMyApplications);

router.delete("/:id/withdraw", protect, withdrawApplication);

/**
 * HR / Admin routes
 */
router.get(
  "/stats",
  protect,
  authorizeRoles("hr", "admin"),
  getApplicationStats
);

router.get("/", protect, authorizeRoles("hr", "admin"), getAllApplications);

router.get(
  "/job/:jobId",
  protect,
  authorizeRoles("hr", "admin"),
  getApplicationsByJob
);

// ✅ CRITICAL: Put more specific routes BEFORE generic ones
router.get(
  "/:id/download",
  protect,
  authorizeRoles("hr", "admin"),
  downloadResume
);

router.get("/:id", protect, getApplicationById); // ✅ This must come AFTER /:id/download

router.patch(
  "/:id/status",
  protect,
  authorizeRoles("hr", "admin"),
  updateApplicationStatus
);

router.delete("/:id", protect, authorizeRoles("admin"), deleteApplication);

export default router;
