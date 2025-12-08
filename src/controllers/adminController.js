const User = require("../models/User");

exports.getManageUsersPage = async (req, res) => {
  try {
    const users = await User.find().select("name email role approved createdAt").lean();
    res.src/controllers/adminController.js
const User = require('../models/User');

exports.getManageUsersPage = async (req, res) => {
  try {
    const users = await User.find().select('name email role approved createdAt').lean();
    res.render('admin/manage-users', {
      title: 'Manage Users',
      users
    });
  } catch (err) {
    res.status(500).send('Error loading manage users');
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('name email role approved createdAt').lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
render("admin/manage-users", {
      title: "Manage Users",
      users
    });
  } catch (err) {
    res.status(500).send("Error loading manage users");
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("name email role approved createdAt").lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
