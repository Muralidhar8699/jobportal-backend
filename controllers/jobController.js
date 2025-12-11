import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";

// Create a new job
export const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      requiredSkills,
      experience,
      location,
      salary,
      status = "draft",
    } = req.body;

    // Validation
    if (
      !title ||
      !description ||
      !requiredSkills ||
      requiredSkills.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide title, description, and required skills",
      });
    }

    const db = getDb();
    const jobsCollection = db.collection("jobs");

    const newJob = {
      title,
      description,
      requiredSkills: Array.isArray(requiredSkills)
        ? requiredSkills.map((skill) => skill.toLowerCase().trim())
        : [],
      experience: experience || { min: 0, max: 0 },
      location: location || "",
      salary: salary || null,
      status,
      createdBy: new ObjectId(req.user._id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await jobsCollection.insertOne(newJob);

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: {
        _id: result.insertedId,
        ...newJob,
      },
    });
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all jobs (with filters) - HR & Admin only - WITH CREATOR DETAILS
export const getAllJobs = async (req, res) => {
  try {
    const { status, location, skills, page = 1, limit = 10 } = req.query;
    const db = getDb();
    const jobsCollection = db.collection("jobs");

    // Build match query
    const matchQuery = {};

    // ✅ ROLE-BASED FILTERING
    // If user is HR, only show their jobs
    // If user is Admin, show all jobs
    if (req.user.role === "hr") {
      matchQuery.createdBy = new ObjectId(req.user._id);
    }
    // Admin sees all jobs (no additional filter needed)

    if (status) {
      matchQuery.status = status;
    }

    if (location) {
      matchQuery.location = { $regex: location, $options: "i" };
    }

    if (skills) {
      const skillsArray = skills.split(",").map((s) => s.toLowerCase().trim());
      matchQuery.requiredSkills = { $in: skillsArray };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Aggregation pipeline to populate creator details
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "createdBy.password": 0, // Exclude password from user details
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const jobs = await jobsCollection.aggregate(pipeline).toArray();

    // Get total count
    const total = await jobsCollection.countDocuments(matchQuery);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all jobs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get published jobs (for applicants) - Public - WITH CREATOR DETAILS
export const getPublishedJobs = async (req, res) => {
  try {
    const { location, skills, experience, page = 1, limit = 10 } = req.query;
    const db = getDb();
    const jobsCollection = db.collection("jobs");

    const matchQuery = { status: "published" };
    if (location) {
      matchQuery.location = { $regex: location, $options: "i" };
    }
    if (skills) {
      const skillsArray = skills.split(",").map((s) => s.toLowerCase().trim());
      matchQuery.requiredSkills = { $in: skillsArray };
    }
    if (experience) {
      matchQuery["experience.min"] = { $lte: parseInt(experience) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Aggregation pipeline to populate creator details
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "createdBy.password": 0, // Exclude password
          "createdBy.email": 0, // Optionally hide email for public view
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const jobs = await jobsCollection.aggregate(pipeline).toArray();
    const total = await jobsCollection.countDocuments(matchQuery);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get published jobs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get job by ID - WITH CREATOR DETAILS
export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const db = getDb();
    const jobsCollection = db.collection("jobs");

    // Aggregation pipeline to populate creator details
    const pipeline = [
      { $match: { _id: new ObjectId(id) } },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          "createdBy.password": 0, // Exclude password
        },
      },
    ];

    const jobs = await jobsCollection.aggregate(pipeline).toArray();

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      data: jobs[0],
    });
  } catch (error) {
    console.error("Get job by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Update job
export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const db = getDb();
    const jobsCollection = db.collection("jobs");

    // Check if job exists
    const existingJob = await jobsCollection.findOne({ _id: new ObjectId(id) });

    if (!existingJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Process required skills if provided
    if (updates.requiredSkills && Array.isArray(updates.requiredSkills)) {
      updates.requiredSkills = updates.requiredSkills.map((skill) =>
        skill.toLowerCase().trim()
      );
    }

    // Don't allow updating these fields
    delete updates._id;
    delete updates.createdBy;
    delete updates.createdAt;

    updates.updatedAt = new Date();

    const result = await jobsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: "after" }
    );

    res.status(200).json({
      success: true,
      message: "Job updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete job
export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const db = getDb();
    const jobsCollection = db.collection("jobs");

    const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Delete job error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Publish/Unpublish/Close job
export const publishJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    if (!["published", "draft", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'published', 'draft', or 'closed'",
      });
    }

    const db = getDb();
    const jobsCollection = db.collection("jobs");

    const result = await jobsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Job status changed to ${status} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Publish job error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get job statistics
export const getJobStats = async (req, res) => {
  try {
    const db = getDb();
    const jobsCollection = db.collection("jobs");
    const applicationsCollection = db.collection("applications");

    // ✅ Filter for HR - only their jobs
    const jobFilter = {};
    if (req.user.role === "hr") {
      jobFilter.createdBy = new ObjectId(req.user._id);
    }

    const [totalJobs, publishedJobs, draftJobs, closedJobs] = await Promise.all(
      [
        jobsCollection.countDocuments(jobFilter),
        jobsCollection.countDocuments({ ...jobFilter, status: "published" }),
        jobsCollection.countDocuments({ ...jobFilter, status: "draft" }),
        jobsCollection.countDocuments({ ...jobFilter, status: "closed" }),
      ]
    );

    // Get job IDs for this user (for application count)
    const userJobs = await jobsCollection
      .find(jobFilter, { projection: { _id: 1 } })
      .toArray();
    const jobIds = userJobs.map((job) => job._id);

    const totalApplications = await applicationsCollection.countDocuments({
      jobId: { $in: jobIds },
    });

    // Top skills across user's jobs
    const topSkills = await jobsCollection
      .aggregate([
        { $match: jobFilter },
        { $unwind: "$requiredSkills" },
        { $group: { _id: "$requiredSkills", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Job-wise applicant count (only user's jobs)
    const jobWiseStats = await applicationsCollection
      .aggregate([
        { $match: { jobId: { $in: jobIds } } },
        { $group: { _id: "$jobId", applicantCount: { $sum: 1 } } },
        {
          $lookup: {
            from: "jobs",
            localField: "_id",
            foreignField: "_id",
            as: "jobDetails",
          },
        },
        { $unwind: "$jobDetails" },
        {
          $project: {
            jobId: "$_id",
            jobTitle: "$jobDetails.title",
            applicantCount: 1,
            _id: 0,
          },
        },
        { $sort: { applicantCount: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    res.status(200).json({
      success: true,
      data: {
        totalJobs,
        publishedJobs,
        draftJobs,
        closedJobs,
        totalApplications,
        topSkills: topSkills.map((skill) => ({
          skill: skill._id,
          count: skill.count,
        })),
        topJobsByApplications: jobWiseStats,
      },
    });
  } catch (error) {
    console.error("Get job stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get Admin Dashboard Stats
export const getAdminDashboard = async (req, res) => {
  try {
    const db = getDb();
    const jobsCollection = db.collection("jobs");
    const applicationsCollection = db.collection("applications");
    const usersCollection = db.collection("users");

    // Date filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfWeek = new Date();
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - 7);

    // 1. Basic Statistics
    const [
      totalJobs,
      publishedJobs,
      draftJobs,
      closedJobs,
      totalApplications,
      pendingApplications,
      reviewedApplications,
      shortlistedApplications,
      rejectedApplications,
      selectedApplications,
      totalHRs,
      totalApplicants,
      jobsThisMonth,
      applicationsThisWeek,
      shortlistedToday,
    ] = await Promise.all([
      jobsCollection.countDocuments(),
      jobsCollection.countDocuments({ status: "published" }),
      jobsCollection.countDocuments({ status: "draft" }),
      jobsCollection.countDocuments({ status: "closed" }),
      applicationsCollection.countDocuments(),
      applicationsCollection.countDocuments({ status: "pending" }),
      applicationsCollection.countDocuments({ status: "reviewed" }),
      applicationsCollection.countDocuments({ status: "shortlisted" }),
      applicationsCollection.countDocuments({ status: "rejected" }),
      applicationsCollection.countDocuments({ status: "selected" }),
      usersCollection.countDocuments({ role: "hr" }),
      usersCollection.countDocuments({ role: "applicant" }),
      jobsCollection.countDocuments({ createdAt: { $gte: firstDayOfMonth } }),
      applicationsCollection.countDocuments({
        createdAt: { $gte: firstDayOfWeek },
      }),
      applicationsCollection.countDocuments({
        status: "shortlisted",
        updatedAt: { $gte: today },
      }),
    ]);

    // 2. Average Resume Score
    const avgScoreResult = await applicationsCollection
      .aggregate([
        { $group: { _id: null, avgScore: { $avg: "$resumeScore" } } },
      ])
      .toArray();
    const avgResumeScore = avgScoreResult[0]?.avgScore || 0;

    // 3. Top 5 Jobs by Applications
    const topJobs = await applicationsCollection
      .aggregate([
        { $group: { _id: "$jobId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "jobs",
            localField: "_id",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: "$job" },
        {
          $project: {
            title: "$job.title",
            applicationsCount: "$count",
            status: "$job.status",
            _id: 0,
          },
        },
      ])
      .toArray();

    // 4. Top 10 Skills in Demand
    const topSkills = await jobsCollection
      .aggregate([
        { $match: { status: "published" } },
        { $unwind: "$requiredSkills" },
        { $group: { _id: "$requiredSkills", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { skill: "$_id", count: 1, _id: 0 } },
      ])
      .toArray();

    // 5. Most Active HRs (Top 5)
    const topHRs = await jobsCollection
      .aggregate([
        { $group: { _id: "$createdBy", jobCount: { $sum: 1 } } },
        { $sort: { jobCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "hr",
          },
        },
        { $unwind: "$hr" },
        {
          $project: {
            name: "$hr.name",
            email: "$hr.email",
            jobsPosted: "$jobCount",
            _id: 0,
          },
        },
      ])
      .toArray();

    // 6. Recent Activities (Last 10)
    const recentActivities = await applicationsCollection
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "applicantId",
            foreignField: "_id",
            as: "applicant",
          },
        },
        {
          $lookup: {
            from: "jobs",
            localField: "jobId",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: "$applicant" },
        { $unwind: "$job" },
        {
          $project: {
            applicantName: "$applicant.name",
            jobTitle: "$job.title",
            status: 1,
            createdAt: 1,
            _id: 0,
          },
        },
      ])
      .toArray();

    // 7. Interviews Scheduled Count (assuming status = "interview_scheduled")
    const interviewsScheduled = await applicationsCollection.countDocuments({
      status: "interview_scheduled",
    });

    res.status(200).json({
      success: true,
      data: {
        // Main Statistics
        stats: {
          totalJobs,
          publishedJobs,
          draftJobs,
          closedJobs,
          totalApplications,
          pendingApplications,
          reviewedApplications,
          shortlistedApplications,
          rejectedApplications,
          selectedApplications,
          totalHRs,
          totalApplicants,
          avgResumeScore: Math.round(avgResumeScore),
        },
        // Quick Stats
        quickStats: {
          jobsThisMonth,
          applicationsThisWeek,
          shortlistedToday,
          interviewsScheduled,
        },
        // Top Performers
        topJobs,
        topSkills,
        topHRs,
        // Recent Activity
        recentActivities,
      },
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
