import { Player, Message, AdminUser, DailyDeletion  } from '../models/index.js';
import { DeletedMessageStats } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';

// Helper function to parse timeframe string (e.g., '60m', '12h', '7d')
const parseTimeframe = (timeframe) => {
  const unit = timeframe.slice(-1);
  const value = parseInt(timeframe.slice(0, -1));
  let milliseconds;

  switch (unit) {
    case 'm':
      milliseconds = value * 60 * 1000;
      break;
    case 'h':
      milliseconds = value * 60 * 60 * 1000;
      break;
    case 'd':
      milliseconds = value * 24 * 60 * 60 * 1000;
      break;
    case 'y':
      milliseconds = value * 365 * 24 * 60 * 60 * 1000;
      break;
    default: // Assume months if not specified (e.g., '1mo', '3mo')
      milliseconds = value * 30 * 24 * 60 * 60 * 1000;
      break;
  }

  return new Date(Date.now() - milliseconds);
};

export const dashboardController = {
  // Get dashboard statistics
  getStats: handleAsyncError(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const startDate = parseTimeframe(timeRange);

    const [playerCount, messageCount, adminUserCount] = await Promise.all([
      Player.countDocuments(),
      Message.countDocuments(),
      AdminUser.countDocuments()
    ]);

    // Get deletion stats
    const deletionStats = await DeletedMessageStats.findOne();

    const [activePlayers, pcPlayers, consolePlayers, lfgMessages, validMessages] = await Promise.all([
      Player.countDocuments({ active: true }),
      Player.countDocuments({ platform: 'PC' }),
      Player.countDocuments({ platform: 'Console' }),
      Message.countDocuments({ is_lfg: true }),
      Message.countDocuments({ is_valid: true })
    ]);

    // AI Status counts (all time)
    const [pendingMessages, completedMessages, failedMessages, expiredMessages, pendingPrefilterMessages] = await Promise.all([
      Message.countDocuments({ ai_status: 'pending', is_valid: true }),
      Message.countDocuments({ ai_status: 'completed' }),
      Message.countDocuments({ ai_status: 'failed' }),
      Message.countDocuments({ ai_status: 'expired' }),
      Message.countDocuments({ ai_status: 'pending_prefilter' })
    ]);

    // Calculate messages per minute for the selected time range
    const timeRangeMs = Date.now() - startDate.getTime();
    const timeRangeMinutes = timeRangeMs / (1000 * 60);
    
    const [messagesInRange, validMessagesInRange] = await Promise.all([
      Message.countDocuments({ message_date: { $gte: startDate } }),
      Message.countDocuments({ message_date: { $gte: startDate }, is_valid: true })
    ]);

    // Calculate messages today (from 00:00 today until now) - for "deleted today"
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Messages for the selected time range (not just today)
    const [messagesForTimeRange, validMessagesForTimeRange] = await Promise.all([
      Message.countDocuments({ message_date: { $gte: startDate } }),
      Message.countDocuments({ message_date: { $gte: startDate }, is_valid: true })
    ]);

    res.json({
      counts: {
        players: playerCount,
        messages: messageCount,
        adminUsers: adminUserCount,
        deletedMessages: deletionStats?.totalDeleted || 0,
        activePlayers,
        pcPlayers,
        consolePlayers,
        lfgMessages,
        validMessages,
        pendingMessages,
        completedMessages,
        failedMessages,
        expiredMessages,
        pendingPrefilterMessages,
        messagesPerMinute: timeRangeMinutes > 0 ? Math.round(messagesInRange / timeRangeMinutes * 100) / 100 : 0,
        validMessagesPerMinute: timeRangeMinutes > 0 ? Math.round(validMessagesInRange / timeRangeMinutes * 100) / 100 : 0,
        messagesToday: messagesForTimeRange,
        validMessagesToday: validMessagesForTimeRange,
        deletedToday: deletionStats?.deletedToday || 0
      }
    });
  }),

  // Get messages over time for charts
  getMessagesChartData: handleAsyncError(async (req, res) => {
    const { timeframe = '24h' } = req.query;
    const startDate = parseTimeframe(timeframe);

    // Determine the appropriate grouping based on the timeframe
    let groupBy = {
        year: { $year: '$message_date' },
        month: { $month: '$message_date' },
        day: { $dayOfMonth: '$message_date' },
        hour: { $hour: '$message_date' },
        minute: { $minute: '$message_date' },
    };

    const durationInDays = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (durationInDays > 30) { // If more than a month, group by day
      delete groupBy.hour;
      delete groupBy.minute;
    } else if (durationInDays > 2) { // If more than 2 days, group by hour
      delete groupBy.minute;
    }

    const messages = await Message.aggregate([
      {
        $match: { message_date: { $gte: startDate } }
      },
      {
        $group: {
          _id: groupBy,
          totalMessages: { $sum: 1 },
          validMessages: {
            $sum: { $cond: ['$is_valid', 1, 0] }
          },
          lfgMessages: {
            $sum: { $cond: ['$is_lfg', 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 }
      }
    ]);

    const formattedData = messages.map(item => ({
      date: new Date(
        item._id.year,
        item._id.month - 1,
        item._id.day,
        item._id.hour || 0,
        item._id.minute || 0
      ).toISOString(),
      totalCount: item.totalMessages,
      validCount: item.validMessages,
      lfgCount: item.lfgMessages,
    }));

    res.json(formattedData);
  }),

  // Get platform distribution
  getPlatformDistribution: handleAsyncError(async (req, res) => {
    const distribution = await Player.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(distribution);
  }),

  // Get deleted messages chart data
  getDeletedMessagesChartData: handleAsyncError(async (req, res) => {
    const { timeframe = '7d' } = req.query;
    const startDate = parseTimeframe(timeframe);

    const deletedMessages = await DeletedMessage.aggregate([
      {
        $match: { deleted_at: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$deleted_at' },
            month: { $month: '$deleted_at' },
            day: { $dayOfMonth: '$deleted_at' }
          },
          count: { $sum: 1 },
          avgDeletionTime: { $avg: '$deletion_time_minutes' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    const formattedData = deletedMessages.map(item => ({
      date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString(),
      count: item.count,
      avgDeletionTimeMinutes: Math.round(item.avgDeletionTime * 100) / 100
    }));

    res.json(formattedData);
  }),

  // Get AI status distribution
  getAIStatusDistribution: handleAsyncError(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const startDate = parseTimeframe(timeRange);
    
    const distribution = await Message.aggregate([
      {
        $match: { message_date: { $gte: startDate } }
      },
      {
        $group: {
          _id: '$ai_status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Add unknown status for messages without ai_status (null values)
    const unknownCount = await Message.countDocuments({ 
      ai_status: { $exists: false },
      message_date: { $gte: startDate }
    });
    if (unknownCount > 0) {
      distribution.push({ _id: 'unknown', count: unknownCount });
    }
    
    res.json(distribution);
  }),
};