import bcrypt from "bcryptjs";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// @desc    Get all users (Admin only)
// @route   GET /user/all
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const db = getDB();
    const { role, page = 1, limit = 10 } = req.query;

    const filter = role ? { role } : {};
    const skip = (page - 1) * limit;

    const users = await db
      .collection("users")
      .find(filter, { projection: { password: 0 } })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection("users").countDocuments(filter);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get single user by ID
// @route   GET /user/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create HR/Admin user (Admin only)
// @route   POST /user/create
// @access  Private/Admin
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Please fill all required fields" });
    }

    if (!["hr", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Use 'hr' or 'admin'" });
    }

    const db = getDB();

    // Check if user exists
    const userExists = await db
      .collection("users")
      .findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      createdBy: req.user._id,
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);

    res.status(201).json({
      message: `${role.toUpperCase()} user created successfully`,
      user: {
        id: result.insertedId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update user
// @route   PUT /user/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const updateData = {
      ...(name && { name: name.trim() }),
      ...(email && { email: email.toLowerCase().trim() }),
      ...(role && { role }),
      updatedAt: new Date(),
    };

    const result = await db
      .collection("users")
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete user
// @route   DELETE /user/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const result = await db
      .collection("users")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
