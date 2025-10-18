import { AdminUser } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';

export const adminUserController = {
  // Get all admin users with pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, role } = req.query;
    const query = {};
    
    if (role) query.role = role;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      AdminUser.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AdminUser.countDocuments(query)
    ]);

    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  }),

  // Get admin user by email
  getByEmail: handleAsyncError(async (req, res) => {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await AdminUser.findOne({ email }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json(user);
  }),

  // Create new admin user
  create: handleAsyncError(async (req, res) => {
    const user = new AdminUser(req.body);
    await user.save();
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json(userResponse);
  }),

  // Update admin user by email
  updateByEmail: handleAsyncError(async (req, res) => {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await AdminUser.findOneAndUpdate({ email }, req.body, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json(user);
  }),

  // Delete admin user by email
  deleteByEmail: handleAsyncError(async (req, res) => {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await AdminUser.findOneAndDelete({ email });

    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json({ message: 'Admin user deleted successfully' });
  })
};