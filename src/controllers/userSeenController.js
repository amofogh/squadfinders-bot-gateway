import { UserSeen } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateObjectId } from '../utils/validators.js';
import { recordSeen } from '../services/analyticsService.js';

export const userSeenController = {
  // Get all user seen records with pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, user_id, username, active } = req.query;
    const query = {};
    
    if (user_id) query.user_id = user_id;
    if (username) query.username = username;
    if (active !== undefined) query.active = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [records, total] = await Promise.all([
      UserSeen.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      UserSeen.countDocuments(query)
    ]);

    res.json({
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  }),

  // Get user seen record by ID
  getById: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid record ID' });
    }

    const record = await UserSeen.findById(id);

    if (!record) {
      return res.status(404).json({ error: 'User seen record not found' });
    }

    res.json(record);
  }),

  // Create new user seen record
  create: handleAsyncError(async (req, res) => {
    const { user_id, username, message_ids = [] } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if user_seen record already exists
    let record = await UserSeen.findOne({ user_id });

    if (record) {
      // User exists, append new message_ids without duplicates
      const existingIds = new Set(record.message_ids);
      const newIds = message_ids.filter(id => !existingIds.has(id));

      if (newIds.length > 0) {
        record.message_ids.push(...newIds);
        if (username) record.username = username;
        record.active = true; // Ensure it's active when updated
        await record.save();
      }
      
      // Record analytics
      await recordSeen(user_id);

      return res.status(200).json(record);
    } else {
      // Create new record
      const uniqueMessageIds = [...new Set(message_ids)]; // Remove duplicates from input
      record = new UserSeen({
        user_id,
        username,
        message_ids: uniqueMessageIds,
        active: true
      });
      await record.save();
      
      // Record analytics
      await recordSeen(user_id);
      
      return res.status(201).json(record);
    }
  }),

  // Update user seen record
  update: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid record ID' });
    }

    const record = await UserSeen.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!record) {
      return res.status(404).json({ error: 'User seen record not found' });
    }

    res.json(record);
  }),

  // Delete user seen record
  delete: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid record ID' });
    }

    const record = await UserSeen.findByIdAndDelete(id);

    if (!record) {
      return res.status(404).json({ error: 'User seen record not found' });
    }

    res.json({ message: 'User seen record deleted successfully' });
  })
};