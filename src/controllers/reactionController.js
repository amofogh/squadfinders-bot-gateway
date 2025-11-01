import { Reaction } from '../models/Reaction.js';
import { UserAnalytics } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateMessageId } from '../utils/validators.js';
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

  // Get reaction by message_id
  getByMessageId: handleAsyncError(async (req, res) => {
    const { message_id } = req.params;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const reaction = await Reaction.findOne({ message_id: parseInt(message_id, 10) });

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

  // Update reaction by message_id
  updateByMessageId: handleAsyncError(async (req, res) => {
    const { message_id } = req.params;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const updatePayload = { ...req.body };

    if (updatePayload.at && !updatePayload.message_date) {
      updatePayload.message_date = updatePayload.at;
    }

    delete updatePayload.at;

    const reaction = await Reaction.findOneAndUpdate(
      { message_id: parseInt(message_id, 10) },
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    res.json(reaction);
  }),

  // Delete reaction by message_id
  deleteByMessageId: handleAsyncError(async (req, res) => {
    const { message_id } = req.params;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const reaction = await Reaction.findOneAndDelete({ message_id: parseInt(message_id, 10) });

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    reactionLogger.info('Deleted reaction for message', {
      messageId: parseInt(message_id, 10)
    });

    res.json({
      message: 'Reaction deleted successfully',
      deletedCount: 1
    });
  })
};