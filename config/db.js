import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let db;
const client = new MongoClient(
  process.env.MONGO_URI || "mongodb://localhost:27017"
);

const createIndexSafely = async (collection, spec, options = {}) => {
  try {
    await collection.createIndex(spec, options);
  } catch (error) {
    if (error.code === 86) {
      const indexName =
        options.name ||
        Object.keys(spec)
          .map((k) => `${k}_1`)
          .join("_");
      try {
        await collection.dropIndex(indexName);
        await collection.createIndex(spec, options);
      } catch (retryError) {
        console.error(`Failed to recreate index: ${indexName}`);
      }
    } else {
      throw error;
    }
  }
};

export const dbConnect = async () => {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "jobportal");
    console.log(
      `✅ Connected to MongoDB - Database: ${
        process.env.DB_NAME || "jobportal"
      }`
    );

    await createIndexSafely(
      db.collection("users"),
      { email: 1 },
      { unique: true }
    );

    await createIndexSafely(db.collection("jobs"), { status: 1 });
    await createIndexSafely(db.collection("jobs"), { location: 1 });
    await createIndexSafely(db.collection("jobs"), { requiredSkills: 1 });
    await createIndexSafely(db.collection("jobs"), { createdAt: -1 });
    await createIndexSafely(db.collection("jobs"), { createdBy: 1 });

    const applicationsCollection = db.collection("applications");

    await createIndexSafely(
      applicationsCollection,
      { jobId: 1, applicantId: 1 },
      { unique: true, name: "unique_job_applicant" }
    );

    await createIndexSafely(applicationsCollection, { applicantId: 1 });
    await createIndexSafely(applicationsCollection, { jobId: 1 });
    await createIndexSafely(applicationsCollection, { status: 1 });
    await createIndexSafely(applicationsCollection, { resumeScore: -1 });
    await createIndexSafely(applicationsCollection, { appliedAt: -1 });

    console.log("✅ All indexes created successfully");

    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
};

export const getDB = getDb;

export default { dbConnect, getDb, getDB };
