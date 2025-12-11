import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "jobportal"; // ← CHANGED THIS LINE

async function seedAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(dbName); // Uses DB_NAME from .env
    const usersCollection = db.collection("users");

    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({
      email: "admin@company.com",
    });

    if (existingAdmin) {
      console.log("⚠️  Admin account already exists!");
      console.log("📧 Email: admin@company.com");
      await client.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create admin account
    const adminUser = {
      name: "System Admin",
      email: "admin@company.com",
      password: hashedPassword,
      role: "admin",
      createdAt: new Date(),
    };

    await usersCollection.insertOne(adminUser);

    console.log("\n🎉 Admin account created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    admin@company.com");
    console.log("🔑 Password: admin123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!\n");
  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

seedAdmin();
