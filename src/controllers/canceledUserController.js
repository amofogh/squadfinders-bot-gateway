import { CanceledUser, Message, Player } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateObjectId } from '../utils/validators.js';
import { createServiceLogger } from '../utils/logger.js';
import { recordCancel } from '../services/analyticsService.js';

const canceledUserLogger = createServiceLogger('canceled-user-controller');

export const canceledUserController = {
  // Get all canceled users with pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, username } = req.query;
    const query = {};
    
    if (username) query.username = username;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    canceledUserLogger.info('Fetching canceled users', {
      page: parseInt(page),
      limit: parseInt(limit),
      username
    });

    const [users, total] = await Promise.all([
      CanceledUser.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CanceledUser.countDocuments(query)
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

  // Get canceled user by ID
  getById: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await CanceledUser.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'Canceled user not found' });
    }

    res.json(user);
  }),

  // Check if user is canceled by user_id or username
  isCanceled: handleAsyncError(async (req, res) => {
    const { user_id, username } = req.query;

    if (!user_id && !username) {
      return res.status(400).json({ error: 'Either user_id or username is required' });
    }

    const query = {};
    if (user_id) query.user_id = user_id;
    if (username) query.username = username;

    const user = await CanceledUser.findOne(query);

    res.json({
      is_canceled: !!user,
      user: user || null
    });
  }),

  // Create new canceled user
  create: handleAsyncError(async (req, res) => {
    const { user_id, username } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const existing = await CanceledUser.findOne({ user_id });
    if (existing) {
      return res.status(409).json({ error: 'User is already marked as canceled', user_id });
    }

    const user = new CanceledUser(req.body);
    await user.save();

    // Record analytics
    await recordCancel(user_id, {
      username,
      by: 'admin',
      reason: 'Manual cancellation'
    });

    canceledUserLogger.info('Created canceled user entry', {
      userId: user_id,
      username
    });

    const messageStatusFilter = { ai_status: { $in: ['pending', 'pending_prefilter'] } };
    const messageUserConditions = [];
    const playerUserConditions = [];

    if (user_id) {
      messageUserConditions.push({ 'sender.id': user_id });
      playerUserConditions.push({ 'sender.id': user_id });
    }
    if (username) {
      messageUserConditions.push({ 'sender.username': username });
      playerUserConditions.push({ 'sender.username': username });
    }

    let messagesCanceled = 0;
    if (messageUserConditions.length > 0) {
      messageStatusFilter.$or = messageUserConditions;
      const messageUpdateResult = await Message.updateMany(
        messageStatusFilter,
        { $set: { ai_status: 'canceled_by_user' } }
      );
      messagesCanceled = messageUpdateResult.modifiedCount || 0;
    }

    let playersDeactivated = 0;
    if (playerUserConditions.length > 0) {
      const playerUpdateResult = await Player.updateMany(
        { $or: playerUserConditions },
        { $set: { active: false } }
      );
      playersDeactivated = playerUpdateResult.modifiedCount || 0;
    }

    canceledUserLogger.info('Applied cancellation cascade', {
      userId: user_id,
      username,
      messagesCanceled,
      playersDeactivated
    });


    res.status(201).json({
      ...user.toObject(),
      updates: {
        messagesCanceled,
        playersDeactivated
      }
    });
  }),

  // Update canceled user
  update: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await CanceledUser.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({ error: 'Canceled user not found' });
    }

    canceledUserLogger.info('Updated canceled user', {
      id,
      userId: user.user_id
    });

    res.json(user);
  }),

  // Delete canceled user
  delete: handleAsyncError(async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const user = await CanceledUser.findOneAndDelete({ user_id });

    if (!user) {
      return res.status(404).json({ error: 'Canceled user not found' });
    }

    canceledUserLogger.info('Deleted canceled user', {
      userId: user_id,
      username: user.username
    });

    res.json({ message: 'Canceled user deleted successfully' });
  })
};