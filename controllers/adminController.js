const mongoose = require("mongoose");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const BloodGroup = require("../models/BloodGroups");
const RequirementRequest = require("../models/RequirementRequest");
const DonationRequest = require("../models/DonationRequest");
const {
  sendBloodDonationCompleteMessage,
} = require("../helpers/whatsappHelper");

exports.addBloodGroup = async (req, res) => {
  try {
    const { type, description } = req.body;
    if (!type) {
      return res.status(400).json({ error: "Blood group type is required." });
    }
    const newBloodGroup = new BloodGroup({
      type,
      description,
    });
    await newBloodGroup.save();
    return res.status(201).json({
      message: "Blood group added successfully.",
      bloodGroup: newBloodGroup,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Blood group already exists." });
    }
    return res.status(500).json({ error: "Server error." });
  }
};

exports.updateBloodGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description } = req.body;

    const updateData = {};

    if (type) {
      // Check if the new type already exists (excluding the current one)
      const existing = await BloodGroup.findOne({
        type: type.trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(409).json({
          error: "Another blood group with the same type already exists.",
        });
      }
      updateData.type = type.trim();
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields provided to update." });
    }

    const updatedBloodGroup = await BloodGroup.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedBloodGroup) {
      return res.status(404).json({ error: "Blood group not found." });
    }

    return res.status(200).json({
      message: "Blood group updated successfully.",
      bloodGroup: updatedBloodGroup,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.deleteBloodGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await BloodGroup.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Blood group not found." });
    }

    return res.status(200).json({
      message: "Blood group deleted successfully.",
      deletedBloodGroup: deleted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.getBloodGroupsWithCount = async (req, res) => {
  try {
    const result = await BloodGroup.aggregate([
      {
        $lookup: {
          from: "users", // this should match the actual MongoDB collection name
          localField: "_id",
          foreignField: "bloodgroup",
          as: "users",
        },
      },
      {
        $project: {
          type: 1,
          description: 1,
          userCount: { $size: "$users" },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    return res.status(200).json({ groups: result });
  } catch (err) {
    return res.status(500).json({ error: "Server error. " + err.message });
  }
};

exports.addUserManually = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      employeeId,
      designation,
      shopNo,
      bloodgroupType,
    } = req.body;

    // Check if user with same email or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email: email }, { phone: phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User with this email or phone already exists",
      });
    }

    let bloodgroup = [];

    if (bloodgroupType) {
      const bg = await BloodGroup.findOne({ type: bloodgroupType.trim() });
      if (bg) {
        bloodgroup = [bg._id];
      }
    }

    // Create new user
    const user = new User({
      name,
      email: email,
      phone: phone,
      employeeId,
      designation,
      shopNo,
      password: "123456", // default password
      bloodgroup,
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to create user", details: err.message });
  }
};

exports.uploadUserCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const results = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        fs.unlinkSync(filePath); // Delete file after processing

        const createdUsers = [];
        const skippedUsers = [];

        for (const userData of results) {
          try {
            const email = userData.email?.trim();
            const phone = userData.phone?.trim();

            // Skip if email or phone is missing
            if (!email || !phone) {
              skippedUsers.push({
                reason: "Missing email or phone",
                data: userData,
              });
              continue;
            }

            // Check if user with same email or phone exists
            const existingUser = await User.findOne({
              $or: [{ email }, { phone }],
            });

            if (existingUser) {
              skippedUsers.push({
                reason: "Duplicate email or phone",
                data: userData,
              });
              continue;
            }

            // Find blood group ID if available
            let bloodGroupId = null;
            if (userData.bloodgroup) {
              const bg = await BloodGroup.findOne({
                type: userData.bloodgroup.trim(),
              });
              if (bg) {
                bloodGroupId = bg._id;
              }
            }

            // Create new user
            const user = new User({
              name: userData.name,
              email,
              phone,
              employeeId: userData.employeeId || null,
              designation: userData.designation || "Others",
              shopNo: userData.shopNo || null,
              password: "123456", // default password
              bloodgroup: bloodGroupId,
            });

            await user.save();
            createdUsers.push(user);
          } catch (err) {
            console.error(
              `Error creating user ${userData.email}:`,
              err.message
            );
            skippedUsers.push({ reason: "Error saving user", data: userData });
          }
        }

        res.status(201).json({
          message: "User upload completed",
          createdCount: createdUsers.length,
          skippedCount: skippedUsers.length,
          users: createdUsers,
          skipped: skippedUsers,
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "Failed to parse CSV" });
      });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};

// exports.uploadUserExcel = async(req, res) = {
//   // user can upload excel also.
// }

exports.getAllUser = async (req, res) => {
  try {
    const userType = req.query.type;
    let filter = {};

    if (userType === "railway") {
      filter.employeeId = { $ne: null }; // Not null
    } else if (userType === "others") {
      filter.employeeId = null; // Exactly null
    }
    const users = await User.find(
      filter,
      "name email phone bloodgroup designation shopNo employeeId"
    ).populate("bloodgroup", "type description");

    res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId)
      .select("name email phone employeeId designation shopNo bloodgroup")
      .populate("bloodgroup", "type description");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};

exports.getUsersByBloodGroup = async (req, res) => {
  try {
    const bloodGroupId = req.params.id;
    const userType = req.query.type; // "railway" | "others" | undefined

    // Start with base filter for blood group
    let filter = { bloodgroup: bloodGroupId };

    // Add optional filter based on query param
    if (userType === "railway") {
      filter.employeeId = { $ne: null };
    } else if (userType === "others") {
      filter.employeeId = null;
    }

    const users = await User.find(filter)
      .select("name email phone designation employeeId shopNo avatar")
      .populate("bloodgroup", "type");

    res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

exports.getCardStats = async (req, res) => {
  try {
    const totalNoOfUsers = await User.countDocuments();

    const totalRECount = await User.countDocuments({
      employeeId: { $exists: true, $ne: null },
    });

    const otherUserCount = await User.countDocuments({
      $or: [{ employeeId: { $exists: false } }, { employeeId: null }],
    });

    res.status(200).json({
      totalUsers: totalNoOfUsers,
      railwayUsers: totalRECount,
      otherUsers: otherUserCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch! " + err.message });
  }
};

exports.viewAllRequests = async (req, res) => {
  const userType = req.query.type; // 'railway' or 'others'
  const statusFilter = req.query.status; // Optional: 'Pending', 'Fulfilled', 'Cancelled'

  console.log(userType, statusFilter);

  try {
    // Initial DB query (filter by status at DB level)
    const dbFilter = {};
    if (statusFilter) {
      dbFilter.status = statusFilter;
    }

    const requests = await RequirementRequest.find(dbFilter)
      .populate("userId", "name email employeeId") // Include employeeId for userType filtering
      .populate("bloodgroup", "group")
      .sort({ createdAt: -1 });

    // Filter by userType in JS (since employeeId is in populated user)
    const filteredRequests = requests.filter((request) => {
      const employeeId = request.userId?.employeeId;

      if (userType === "railway") {
        return employeeId !== null && employeeId !== undefined;
      }

      if (userType === "others") {
        return employeeId === null || employeeId === undefined;
      }

      return true; // No userType filter
    });

    res.status(200).json({ requests: filteredRequests });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching requests", error: err.message });
  }
};

exports.viewRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await RequirementRequest.findById(id)
      .populate("userId", "name email")
      .populate("bloodgroup", "group");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.status(200).json(request);
  } catch (err) {
    res.status(500).json({ message: "Error fetching request", error: err });
  }
};

exports.getAllDonationRequests = async (req, res) => {
  try {
    const userType = req.query.type; // 'railway' or 'others'
    const status = req.query.status; // 'Pending', 'Fulfilled', 'Cancelled'

    let filter = {};
    if (status) {
      filter.status = status;
    }

    const requests = await DonationRequest.find(filter)
      .populate({
        path: "userId",
        select: "name email employeeId",
      })
      .populate("bloodgroup", "type description")
      .sort({ createdAt: -1 });

    const filteredRequests = requests.filter((request) => {
      const employeeId = request.userId?.employeeId;

      if (userType === "railway") {
        return employeeId !== null && employeeId !== undefined;
      } else if (userType === "others") {
        return employeeId === null || employeeId === undefined;
      }
      return true; // No userType filter
    });

    res.status(200).json({ requests: filteredRequests });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching donation requests",
      error: err.message,
    });
  }
};

exports.getDonationRequestById = async (req, res) => {
  const { id } = req.params;
  try {
    const request = await DonationRequest.findById(id)
      .populate("userId", "name email")
      .populate("bloodgroup", "group");

    if (!request) {
      return res.status(404).json({ message: "Donation request not found" });
    }

    res.status(200).json(request);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching donation request", error: err.message });
  }
};

exports.getDonationStats = async (req, res) => {
  try {
    const baseMatch = { donationDate: { $ne: null } };

    const getStats = async (format, label) => {
      return DonationRequest.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format, date: "$donationDate" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]);
    };

    const [dailyStats, monthlyStats, yearlyStats] = await Promise.all([
      getStats("%Y-%m-%d", "daily"),
      getStats("%Y-%m", "monthly"),
      getStats("%Y", "yearly"),
    ]);

    res.status(200).json({
      daily: dailyStats,
      monthly: monthlyStats,
      yearly: yearlyStats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
};

exports.getFilteredDonations = async (req, res) => {
  const { type } = req.query;

  if (!["daily", "monthly", "yearly"].includes(type)) {
    return res
      .status(400)
      .json({ error: "Invalid type. Use: daily, monthly, yearly." });
  }

  const now = new Date();
  let startDate, endDate;

  // Set the date range based on the filter type
  if (type === "daily") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (type === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (type === "yearly") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear() + 1, 0, 1);
  }

  try {
    const donations = await DonationRequest.find({
      donationDate: {
        $gte: startDate,
        $lt: endDate,
      },
    })
      .populate("userId", "name email")
      .populate("bloodgroup", "group")
      .sort({ donationDate: -1 });

    res.status(200).json({ type, total: donations.length, donations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
};

exports.updateDonationStatus = async (req, res) => {
  const { donationId } = req.params;
  const { status } = req.body;
  let session;

  try {
    if (
      status !== "Completed" &&
      status !== "Cancelled" &&
      status !== "Pending"
    ) {
      return res.status(400).json({
        error: "Invalid status. Use: Completed or Cancelled or Pending.",
      });
    }

    if (status === "Pending") {
      const donationRequest = await DonationRequest.findById(donationId);
      if (!donationRequest) {
        return res.status(404).json({ error: "Donation request not found." });
      }
      if (donationRequest.status === "Pending") {
        return res
          .status(400)
          .json({ error: "Donation request is already pending." });
      }
      donationRequest.status = "Pending";
      await donationRequest.save();
      return res
        .status(200)
        .json({ message: "Donation request updated successfully." });
    }

    if (status === "Completed") {
      session = await mongoose.startSession();

      const result = await session.withTransaction(async () => {
        // Single aggregation pipeline to get all required data in one query
        const donationData = await DonationRequest.aggregate([
          {
            $match: { _id: new mongoose.Types.ObjectId(donationId) },
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $lookup: {
              from: "bloodgroups",
              localField: "bloodgroup",
              foreignField: "_id",
              as: "bloodGroup",
            },
          },
          {
            $unwind: "$user",
          },
          {
            $unwind: "$bloodGroup",
          },
        ]).session(session);

        if (!donationData || donationData.length === 0) {
          throw new Error("Donation request not found");
        }

        const donation = donationData[0];

        if (donation.status === "Cancelled") {
          throw new Error("Donation request already cancelled");
        }

        if (donation.status === "Completed") {
          throw new Error("Donation request already Completed");
        }

        // Execute both updates concurrently within the transaction
        await Promise.all([
          DonationRequest.findByIdAndUpdate(
            donation._id,
            { $set: { status: "Completed" } },
            { session }
          ),
          User.findByIdAndUpdate(
            donation.userId,
            { $inc: { donationPoints: 10 } },
            { session }
          ),
        ]);

        return {
          userName: donation.user.name,
          userPhone: donation.user.phone,
          bloodGroupName: donation.bloodGroup.name || donation.bloodGroup.type,
          donationDate: donation.donationDate,
        };
      });

      // Send WhatsApp message after successful transaction
      const message = `
  🩸 **BLOOD DONATION COMPLETED** 🩸
  🎉 **Congratulations, Hero!** 🎉
  Your blood donation has been successfully completed and registered in our system.
  
  📋 **Donation Details:**
  ━━━━━━━━━━━━━━━━━━━━━━
  👤 **Donor:** *${result.userName}*
  🩸 **Blood Group:** *${result.bloodGroupName}*
  📅 **Date:** *${result.donationDate.toLocaleString()}*
  ━━━━━━━━━━━━━━━━━━━━━━
  
  ✨ ** Your Impact:**
  ✅ You've potentially * saved up to 3 lives *
  ✅ Your donation helps * patients in critical need *
  ✅ You've * made a difference * in someone's family
  
  🏆 ** What's Next:**
  📄 Your ** digital certificate ** has been generated
  📧 Download link will be ** sent to your email **
  💧 * Stay hydrated * and rest well
  ⏳ You can donate again ** after 56 days **
  
  💝 ** Thank you for being a lifesaver! **
  * Your selfless act of kindness brings hope to those who need it most.*
      You are truly a ** HERO ** in someone's story! 🦸‍♂️🦸‍♀️
  
  ❤️ * Together, we save lives! * ❤️
      `;

      await sendBloodDonationCompleteMessage(result.userPhone, message);

      res.status(200).json({ message: "Donation status updated successfully" });
    }

    if (status === "Cancelled") {
      session = await mongoose.startSession();

      const result = await session.withTransaction(async () => {
        // Single aggregation pipeline to get all required data in one query
        const donationData = await DonationRequest.aggregate([
          {
            $match: { _id: new mongoose.Types.ObjectId(donationId) },
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $lookup: {
              from: "bloodgroups",
              localField: "bloodgroup",
              foreignField: "_id",
              as: "bloodGroup",
            },
          },
          {
            $unwind: "$user",
          },
          {
            $unwind: "$bloodGroup",
          },
        ]).session(session);

        if (!donationData || donationData.length === 0) {
          throw new Error("Donation request not found");
        }

        const donation = donationData[0];

        if (donation.status === "Cancelled") {
          throw new Error("Donation request already cancelled");
        }

        if (donation.status === "Completed") {
          throw new Error("Donation request already Completed");
        }

        // Execute both updates concurrently within the transaction
        await Promise.all([
          DonationRequest.findByIdAndUpdate(
            donation._id,
            { $set: { status: "Cancelled" } },
            { session }
          ),
          User.findByIdAndUpdate(
            donation.userId,
            { $inc: { donationPoints: -10 } },
            { session }
          ),
        ]);

        return {
          userName: donation.user.name,
          userPhone: donation.user.phone,
          bloodGroupName: donation.bloodGroup.name || donation.bloodGroup.type,
          donationDate: donation.donationDate,
        };
      });

      // Send WhatsApp message after successful transaction
      const message = `
  🩸 **BLOOD DONATION CANCELLED** 🩸
  🎉 **Congratulations, Hero!** 🎉
  Your blood donation has been successfully cancelled and registered in our system.
  
  📋 **Donation Details:**
  ━━━━━━━━━━━━━━━━━━━━━━
  👤 **Donor:** *${result.userName}*
  🩸 **Blood Group:** *${result.bloodGroupName}*
  📅 **Date:** *${result.donationDate.toLocaleString()}*
  ━━━━━━━━━━━━━━━━━━━━━━
  
  ✨ ** Your Impact:**
  ✅ You've potentially * saved up to 3 lives *
  ✅ Your donation helps * patients in critical need *
  ✅ You've * made a difference * in someone's family
  
  🏆 ** What's Next:**
  📄 Your ** digital certificate ** has been generated
  📧 Download link will be ** sent to your email **
  💧 * Stay hydrated * and rest well
  ⏳ You can donate again ** after 56 days **
  
  💝 ** Thank you for being a lifesaver! **
  * Your selfless act of kindness brings hope to those who need it most.*
      You are truly a ** HERO ** in someone's story! 🦸‍♂️🦸‍♀️
  
  ❤️ * Together, we save lives! * ❤️
      `;

      await sendBloodDonationCancelMessage(result.userPhone, message);

      res.status(200).json({ message: "Donation status updated successfully" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating donation status", error: err.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
