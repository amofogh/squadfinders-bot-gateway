import { Message } from '../models/Message.js';
import { DeletedMessageStats, DailyDeletion, CanceledUser } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateObjectId, validateMessageId } from '../utils/validators.js';
import { config } from '../config/index.js';
import { logMessageProcessing, logError, createServiceLogger } from '../utils/logger.js';
import { recordUserMessage } from '../services/analyticsService.js';

const messageLogger = createServiceLogger('message-controller');

// Helper method to update deletion statistics  
const updateDeletionStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update deletion counts only
  await Promise.all([
    // Update overall stats
    DeletedMessageStats.findOneAndUpdate(
      {},
      {
        $inc: {
          totalDeleted: 1,
          deletedToday: 1
        },
        $set: { lastResetDate: today }
      },
      { upsert: true }
    ),

    // Update daily stats
    DailyDeletion.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          count: 1
        }
      },
      { upsert: true }
    )
  ]);
};

export const messageController = {
  // Get all messages with filtering and pagination
  getAll: handleAsyncError(async (req, res) => {
    const { page = 1, limit = 100, group_username, sender_username, is_valid, is_lfg, ai_status } = req.query;
    const query = {};

    if (group_username) query['group.group_username'] = group_username;
    if (sender_username) query['sender.username'] = sender_username;
    if (is_valid !== undefined) query.is_valid = is_valid === 'true';
    if (is_lfg !== undefined) query.is_lfg = is_lfg === 'true';
    if (ai_status) query.ai_status = ai_status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ message_date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments(query)
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

  // Get valid messages since a specific timestamp
  getValidSince: handleAsyncError(async (req, res) => {
    const { timestamp } = req.query;

    if (!timestamp) {
      return res.status(400).json({ error: 'Timestamp query parameter is required.' });
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp format. Please use ISO 8601 format.' });
    }

    const messages = await Message.find({
      message_date: { $gte: date },
      is_valid: true
    }).sort({ message_date: -1 }); // Sort by most recent first

    res.json({
      data: messages
    });
  }),

  // Get unprocessed messages for AI processing
  getUnprocessed: handleAsyncError(async (req, res) => {
    const { limit = 50 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 100);
    
    messageLogger.info('getUnprocessed request received', {
      requestedLimit: limit,
      maxLimit: maxLimit,
      autoExpiryEnabled: config.autoExpiry.enabled,
      expiryMinutes: config.autoExpiry.expiryMinutes
    });

    // Only expire messages if auto-expiry is enabled
    if (config.autoExpiry.enabled) {
      const expiryTime = new Date(Date.now() - config.autoExpiry.expiryMinutes * 60 * 1000);
      
      // Count messages that will be expired
      const expiredCount = await Message.countDocuments({
        ai_status: 'pending',
        message_date: { $lt: expiryTime }
      });

      if (expiredCount > 0) {
        messageLogger.info('Expiring old pending messages', {
          count: expiredCount,
          expiryTime: expiryTime.toISOString(),
          expiryMinutes: config.autoExpiry.expiryMinutes
        });
      }

      // First, expire old pending messages
      const expireResult = await Message.updateMany(
        {
          ai_status: 'pending',
          message_date: { $lt: expiryTime }
        },
        {
          $set: { ai_status: 'expired' }
        }
      );

      if (expireResult.modifiedCount > 0) {
        messageLogger.info('Expired old pending messages', {
          expiredCount: expireResult.modifiedCount,
          expiryTime: expiryTime.toISOString()
        });
      }
    }

    const expiryTime = config.autoExpiry.enabled 
      ? new Date(Date.now() - config.autoExpiry.expiryMinutes * 60 * 1000)
      : new Date(0); // If disabled, get all messages

    // Get recent pending messages and mark them as processing
    const recentPendingMessages = await Message.find({
      is_valid: true,
      ai_status: 'pending',
      message_date: { $gte: expiryTime }
    })
    .sort({ message_date: 1 }) // Oldest first
    .limit(maxLimit);

    messageLogger.info('Found pending messages for processing', {
      foundCount: recentPendingMessages.length,
      requestedLimit: maxLimit,
      oldestMessageDate: recentPendingMessages.length > 0 ? recentPendingMessages[0].message_date.toISOString() : null,
      newestMessageDate: recentPendingMessages.length > 0 ? recentPendingMessages[recentPendingMessages.length - 1].message_date.toISOString() : null
    });

    // Mark these messages as processing
    if (recentPendingMessages.length > 0) {
      const messageIds = recentPendingMessages.map(msg => msg._id);
      const messageIdNumbers = recentPendingMessages.map(msg => msg.message_id);
      
      messageLogger.info('Marking messages as processing', {
        count: messageIds.length,
        messageIds: messageIdNumbers.slice(0, 10), // Log first 10 IDs
        totalIds: messageIdNumbers.length
      });

      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { ai_status: 'processing' } }
      );

      // Update the status in the returned data
      recentPendingMessages.forEach(msg => {
        msg.ai_status = 'processing';
      });
    }

    messageLogger.info('getUnprocessed response sent', {
      returnedCount: recentPendingMessages.length,
      requestedLimit: maxLimit
    });

    res.json({
      data: recentPendingMessages,
      count: recentPendingMessages.length
    });
  }),

  // Get pending prefilter messages
  getPendingPrefilter: handleAsyncError(async (req, res) => {
    const { limit = 50 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 100);
    
    messageLogger.info('getPendingPrefilter request received', {
      requestedLimit: limit,
      maxLimit: maxLimit,
      autoExpiryEnabled: config.autoExpiry.enabled,
      expiryMinutes: config.autoExpiry.expiryMinutes
    });

    // Only expire messages if auto-expiry is enabled
    if (config.autoExpiry.enabled) {
      const expiryTime = new Date(Date.now() - config.autoExpiry.expiryMinutes * 60 * 1000);
      
      // Count messages that will be expired
      const expiredCount = await Message.countDocuments({
        ai_status: 'pending_prefilter',
        message_date: { $lt: expiryTime }
      });

      if (expiredCount > 0) {
        messageLogger.info('Expiring old pending_prefilter messages', {
          count: expiredCount,
          expiryTime: expiryTime.toISOString(),
          expiryMinutes: config.autoExpiry.expiryMinutes
        });
      }

      // First, expire old pending_prefilter messages by changing status to expired
      const expireResult = await Message.updateMany(
        {
          ai_status: 'pending_prefilter',
          message_date: { $lt: expiryTime }
        },
        {
          $set: { ai_status: 'expired' }
        }
      );

      if (expireResult.modifiedCount > 0) {
        messageLogger.info('Expired old pending_prefilter messages', {
          expiredCount: expireResult.modifiedCount,
          expiryTime: expiryTime.toISOString()
        });
      }
    }

    const expiryTime = config.autoExpiry.enabled 
      ? new Date(Date.now() - config.autoExpiry.expiryMinutes * 60 * 1000)
      : new Date(0); // If disabled, get all messages

    // Get recent pending_prefilter messages and mark them as pending
    const pendingPrefilterMessages = await Message.find({
      ai_status: 'pending_prefilter',
      message_date: { $gte: expiryTime }
    })
    .sort({ message_date: 1 }) // Oldest first
    .limit(maxLimit);

    messageLogger.info('Found pending_prefilter messages', {
      foundCount: pendingPrefilterMessages.length,
      requestedLimit: maxLimit,
      oldestMessageDate: pendingPrefilterMessages.length > 0 ? pendingPrefilterMessages[0].message_date.toISOString() : null,
      newestMessageDate: pendingPrefilterMessages.length > 0 ? pendingPrefilterMessages[pendingPrefilterMessages.length - 1].message_date.toISOString() : null
    });

    // Mark these messages as pending
    if (pendingPrefilterMessages.length > 0) {
      const messageIds = pendingPrefilterMessages.map(msg => msg._id);
      const messageIdNumbers = pendingPrefilterMessages.map(msg => msg.message_id);
      
      messageLogger.info('Marking messages as pending', {
        count: messageIds.length,
        messageIds: messageIdNumbers.slice(0, 10), // Log first 10 IDs
        totalIds: messageIdNumbers.length
      });

      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { ai_status: 'pending' } }
      );

      // Update the status in the returned data
      pendingPrefilterMessages.forEach(msg => {
        msg.ai_status = 'pending';
      });
    }

    messageLogger.info('getPendingPrefilter response sent', {
      returnedCount: pendingPrefilterMessages.length,
      requestedLimit: maxLimit
    });

    res.json({
      data: pendingPrefilterMessages,
      count: pendingPrefilterMessages.length
    });
  }),

  // Get message by ID or message_id
  getById: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    let message;

    if (validateObjectId(id)) {
      message = await Message.findById(id);
    } else if (validateMessageId(id)) {
      message = await Message.findOne({ message_id: parseInt(id, 10) });
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  }),

  // Create new message
  create: handleAsyncError(async (req, res) => {
    const { sender, group, message } = req.body;
    
    messageLogger.info('Creating new message', {
      senderId: sender?.id,
      senderUsername: sender?.username,
      groupId: group?.group_id,
      groupTitle: group?.group_title,
      messageLength: message?.length
    });

    // Spam validation: Check if the same sender in the same group has posted the exact same message in the past hour
    if (sender && sender.id && group && group.group_id && message) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const existingMessage = await Message.findOne({
        'sender.id': sender.id,
        'group.group_id': group.group_id,
        message: message,
        message_date: { $gte: oneHourAgo }
      });
      
      if (existingMessage) {
        messageLogger.warn('Duplicate message detected', {
          senderId: sender.id,
          groupId: group.group_id,
          existingMessageId: existingMessage.message_id,
          existingMessageDate: existingMessage.message_date.toISOString()
        });

        return res.status(409).json({ 
          error: 'Duplicate message detected',
          message: 'This sender has already posted the same message in this group within the past hour'
        });
      }
    }
    
    const messageData = { ...req.body };

    if (sender?.id || sender?.username) {
      const cancellationQuery = [];
      if (sender?.id) {
        cancellationQuery.push({ user_id: sender.id });
      }
      if (sender?.username) {
        cancellationQuery.push({ username: sender.username });
      }

      if (cancellationQuery.length > 0) {
        const canceledUser = await CanceledUser.findOne({ $or: cancellationQuery });

        if (canceledUser) {
          messageLogger.info('Message belongs to canceled user, overriding status', {
            senderId: sender?.id,
            senderUsername: sender?.username,
            messageId: messageData.message_id
          });

          messageData.ai_status = 'canceled_by_user';
        }
      }
    }

    const newMessage = new Message(messageData);
    await newMessage.save();
    
    // Record analytics
    if (sender?.id) {
      await recordUserMessage(sender.id, newMessage.message_date);
      
      // Update username in analytics if provided
      if (sender.username) {
        await UserAnalytics.updateOne(
          { user_id: sender.id },
          { $set: { username: sender.username } }
        );
      }
    }
    
    messageLogger.info('Message created successfully', {
      messageId: newMessage.message_id,
      aiStatus: newMessage.ai_status,
      messageDate: newMessage.message_date.toISOString()
    });

    res.status(201).json(newMessage);
  }),

  // Update message
  update: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    let message;

    if (validateObjectId(id)) {
      message = await Message.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true
      });
    } else if (validateMessageId(id)) {
      message = await Message.findOneAndUpdate(
        { message_id: parseInt(id, 10) },
        req.body,
        { new: true, runValidators: true }
      );
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  }),

  // Delete message
  delete: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    let message;

    if (validateObjectId(id)) {
      message = await Message.findById(id);
    } else if (validateMessageId(id)) {
      message = await Message.findOne({ message_id: parseInt(id, 10) });
    }

    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }

    // Update deletion statistics
    await updateDeletionStats();

    // Delete the original message
    if (validateObjectId(id)) {
      await Message.findByIdAndDelete(id);
    } else if (validateMessageId(id)) {
      await Message.findOneAndDelete({ message_id: parseInt(id, 10) });
    }

    res.json({
      message: 'Message deleted successfully',
      deleted_at: new Date()
    });
  }),
};