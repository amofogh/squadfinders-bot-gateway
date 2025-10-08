import { Player, Message, AdminUser } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { createServiceLogger } from '../utils/logger.js';

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

const TEHRAN_TIMEZONE = 'Asia/Tehran';

const dashboardLogger = createServiceLogger('dashboard-controller');

const formatDateInTimezone = (date, timeZone = TEHRAN_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset'
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  let offset = parts.timeZoneName ?? '+00:00';
  offset = offset.replace(/^(GMT|UTC)/, '');

  if (!offset) {
    offset = '+00:00';
  }

  if (!offset.startsWith('+') && !offset.startsWith('-')) {
    offset = `+${offset}`;
  }

  if (/^[+-]\d{2}$/.test(offset)) {
    offset = `${offset}:00`;
  } else if (/^[+-]\d:\d{2}$/.test(offset)) {
    const sign = offset[0];
    const [hours, minutes] = offset.slice(1).split(':');
    offset = `${sign}${hours.padStart(2, '0')}:${minutes}`;
  } else if (/^[+-]\d{4}$/.test(offset)) {
    offset = offset.replace(/([+-]\d{2})(\d{2})/, '$1:$2');
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
};

export const dashboardController = {
  // Get dashboard statistics
  getStats: handleAsyncError(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const startDate = parseTimeframe(timeRange);

    dashboardLogger.info('Fetching dashboard stats', { timeRange, startDate: startDate.toISOString() });

    const [playerCount, messageCount, adminUserCount] = await Promise.all([
      Player.countDocuments(),
      Message.countDocuments(),
      AdminUser.countDocuments()
    ]);


    const [activePlayers, pcPlayers, consolePlayers, lfgMessages, validMessages] = await Promise.all([
      Player.countDocuments({ active: true }),
      Player.countDocuments({ platform: 'PC' }),
      Player.countDocuments({ platform: 'Console' }),
      Message.countDocuments({ is_lfg: true }),
      Message.countDocuments({ is_valid: true })
    ]);

    // AI Status counts (all time) - added processingMessages back for old dashboard
    const [pendingMessages, processingMessages, completedMessages, failedMessages, expiredMessages, canceledByUserMessages] = await Promise.all([
      Message.countDocuments({ ai_status: 'pending', is_valid: true }),
      Message.countDocuments({ ai_status: 'processing' }),
      Message.countDocuments({ ai_status: 'completed' }),
      Message.countDocuments({ ai_status: 'failed' }),
      Message.countDocuments({ ai_status: 'expired' }),
      Message.countDocuments({ ai_status: 'canceled_by_user' })
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

    const responsePayload = {
      counts: {
        players: playerCount,
        messages: messageCount,
        adminUsers: adminUserCount,
        activePlayers,
        pcPlayers,
        consolePlayers,
        lfgMessages,
        validMessages,
        pendingMessages,
        processingMessages,
        completedMessages,
        failedMessages,
        expiredMessages,
        canceledByUserMessages,
        messagesPerMinute: timeRangeMinutes > 0 ? Math.round(messagesInRange / timeRangeMinutes * 100) / 100 : 0,
        messagesToday: messagesForTimeRange
      }
    };

    dashboardLogger.info('Dashboard stats computed', {
      timeRange,
      counts: responsePayload.counts
    });

    res.json(responsePayload);
  }),

  // Get messages over time for charts
  getMessagesChartData: handleAsyncError(async (req, res) => {
    const { timeframe = '24h' } = req.query;
    const startDate = parseTimeframe(timeframe);

    dashboardLogger.info('Fetching messages chart data', { timeframe, startDate: startDate.toISOString() });


    const durationInDays = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    let truncateUnit = 'minute';

    if (durationInDays > 30) {
      truncateUnit = 'day';
    } else if (durationInDays > 2) {
      truncateUnit = 'hour';
    }

    const messages = await Message.aggregate([
      {
        $match: { message_date: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$message_date',
              unit: truncateUnit,
              timezone: TEHRAN_TIMEZONE
            }
          },
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
        $sort: { '_id': 1 }
      }
    ]);

    const formattedData = messages.map(item => ({
      date: formatDateInTimezone(item._id),
      totalCount: item.totalMessages,
      validCount: item.validMessages,
      lfgCount: item.lfgMessages,
    }));

    dashboardLogger.info('Messages chart data generated', {
      timeframe,
      points: formattedData.length
    });

    res.json(formattedData);
  }),


  // Get AI status distribution
  getAIStatusDistribution: handleAsyncError(async (req, res) => {
    const { timeRange = '24h' } = req.query;
    const startDate = parseTimeframe(timeRange);

    dashboardLogger.info('Fetching AI status distribution', { timeRange, startDate: startDate.toISOString() });

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
    
    dashboardLogger.info('AI status distribution generated', {
      timeRange,
      statuses: distribution.length
    });

    res.json(distribution);
  }),
};
