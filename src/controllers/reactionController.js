import { Reaction } from '../models/Reaction.js';
import { UserAnalytics } from '../models/index.js';
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
        .sort({ message_date: -1 })
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
    const payload = { ...req.body };

    if (payload.at && !payload.message_date) {
      payload.message_date = payload.at;
    }

    delete payload.at;

    const reaction = new Reaction(payload);
    await reaction.save();

    // Record analytics
    if (reaction.user_id && reaction.emoji) {
      const reactionTimestamp = reaction.message_date || reaction.at || new Date();
      await recordReaction(reaction.user_id, reaction.emoji, reactionTimestamp);
      
      // Update username in analytics if provided
      if (reaction.username) {
        await UserAnalytics.updateOne(
          { user_id: reaction.user_id },
          { $set: { username: reaction.username } }
        );
      }
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

    const updatePayload = { ...req.body };

    if (updatePayload.at && !updatePayload.message_date) {
      updatePayload.message_date = updatePayload.at;
    }

    delete updatePayload.at;

    const reaction = await Reaction.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true
    });

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    res.json(reaction);
  }),

  // Delete reactions by message id
  deleteByMessageId: handleAsyncError(async (req, res) => {
    const { messageId } = req.params;
    const numericMessageId = Number(messageId);

    if (!Number.isFinite(numericMessageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const deletionResult = await Reaction.deleteMany({ message_id: numericMessageId });

    if (!deletionResult.deletedCount) {
      return res.status(404).json({ error: 'No reactions found for the provided message ID' });
    }

    reactionLogger.info('Deleted reactions for message', {
      messageId: numericMessageId,
      deletedCount: deletionResult.deletedCount
    });

    res.json({
      message: 'Reactions deleted successfully',
      deletedCount: deletionResult.deletedCount
    });
  })
};