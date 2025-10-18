import { UserMessage } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';

export const userMessageController = {
  // Get all user messages with pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, user_id, username } = req.query;
    const query = {};
    
    if (user_id) query.user_id = user_id;
    if (username) query.username = username;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [messages, total] = await Promise.all([
      UserMessage.find(query)
        .sort({ message_date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      UserMessage.countDocuments(query)
    ]);

    res.json({
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  }),

  // Get user message by user_id
  getByUserId: handleAsyncError(async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const message = await UserMessage.findOne({ user_id });

    if (!message) {
      return res.status(404).json({ error: 'User message not found' });
    }

    res.json(message);
  }),

  // Create new user message
  create: handleAsyncError(async (req, res) => {
    const message = new UserMessage(req.body);
    await message.save();
    res.status(201).json(message);
  }),

  // Update user message by user_id
  updateByUserId: handleAsyncError(async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const message = await UserMessage.findOneAndUpdate({ user_id }, req.body, {
      new: true,
      runValidators: true
    });

    if (!message) {
      return res.status(404).json({ error: 'User message not found' });
    }

    res.json(message);
  }),

  // Delete user message by user_id
  deleteByUserId: handleAsyncError(async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const message = await UserMessage.findOneAndDelete({ user_id });

    if (!message) {
      return res.status(404).json({ error: 'User message not found' });
    }

    res.json({ message: 'User message deleted successfully' });
  })
};