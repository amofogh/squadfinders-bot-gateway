import { Reaction } from '../models/Reaction.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateObjectId } from '../utils/validators.js';
import { recordReaction } from '../services/analyticsService.js';
import { createServiceLogger } from '../utils/logger.js';

const reactionLogger = createServiceLogger('reaction-controller');

export const reactionController = {
  // Get all reactions with pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, user_id, chat_id, message_id, emoji } = req.query;
    const query = {};
    
    if (user_id) query.user_id = user_id;
    if (chat_id) query.chat_id = chat_id;
    if (message_id) query.message_id = parseInt(message_id);
    if (emoji) query.emoji = emoji;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [reactions, total] = await Promise.all([
      Reaction.find(query)
        .sort({ at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Reaction.countDocuments(query)
    ]);

    res.json({
      data: reactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  }),

  // Get reaction by ID
  getById: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid reaction ID' });
    }

    const reaction = await Reaction.findById(id);

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    res.json(reaction);
  }),

  // Create new reaction
  create: handleAsyncError(async (req, res) => {
    const reaction = new Reaction(req.body);
    await reaction.save();
    
    // Record analytics
    if (reaction.user_id && reaction.emoji) {
      await recordReaction(reaction.user_id, reaction.emoji, reaction.at);
    }
    
    reactionLogger.info('Reaction created successfully', {
      reactionId: reaction._id.toString(),
      userId: reaction.user_id,
      emoji: reaction.emoji
    });
    
    res.status(201).json(reaction);
  }),

  // Update reaction
  update: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid reaction ID' });
    }

    const reaction = await Reaction.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    res.json(reaction);
  }),

  // Delete reaction
  delete: handleAsyncError(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid reaction ID' });
    }

    const reaction = await Reaction.findByIdAndDelete(id);

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    res.json({ message: 'Reaction deleted successfully' });
  })
};