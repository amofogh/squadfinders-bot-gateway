import {Player, Message, AdminUser} from '../models/index.js';
import {handleAsyncError} from '../utils/errorHandler.js';
import logger, {createServiceLogger} from '../utils/logger.js';

// Helper function to parse timeframe string (e.g., '60m', '12h', '7d')
export const parseTimeframe = (timeframe = '24h') => {
    const s = String(timeframe).trim().toLowerCase();

    // special: "all" -> start of epoch (works with toISOString and $gte)
    if (s === 'all') return new Date(0);

    // pattern like: 15m, 12h, 7d, 2w, 3mo, 1y
    const match = s.match(/^(\d+)\s*(m|h|d|w|mo|y)$/);
    if (match) {
        const n = Number(match[1]);
        const unit = match[2];
        const msMap = {
            m: 60 * 1000,                    // minute
            h: 60 * 60 * 1000,               // hour
            d: 24 * 60 * 60 * 1000,          // day
            w: 7 * 24 * 60 * 60 * 1000,      // week
            mo: 30 * 24 * 60 * 60 * 1000,    // month (approx)
            y: 365 * 24 * 60 * 60 * 1000,    // year (approx)
        };
        return new Date(Date.now() - n * msMap[unit]);
    }

    // allow absolute dates like "2025-10-01" or ISO strings
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt;

    // fallback: default to last 24h
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
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

        const {timeRange = '24h'} = req.query;
        const startDate = parseTimeframe(timeRange);
        dashboardLogger.info('Fetching dashboard stats', {
            timeRange,
            startDate: startDate.toISOString()
        });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todayMatch = {message_date: {$gte: startOfToday}};

        const [
            playerCount,
            messageCount,
            adminUserCount,
            activePlayers,
            pcPlayers,
            consolePlayers,
            lfgMessages,
            validMessages,
            pendingMessages,
            processingMessages,
            messagesToday,
            validMessagesToday
        ] = await Promise.all([
            Player.countDocuments(),
            Message.countDocuments(),
            AdminUser.countDocuments(),
            Player.countDocuments({active: true}),
            Player.countDocuments({platform: 'PC'}),
            Player.countDocuments({platform: 'Console'}),
            Message.countDocuments({is_lfg: true}),
            Message.countDocuments({is_valid: true}),
            Message.countDocuments({ai_status: 'pending'}),
            Message.countDocuments({ai_status: 'processing'}),
            Message.countDocuments(todayMatch),
            Message.countDocuments({...todayMatch, is_valid: true})
        ]);

        logger.info(startDate)
        const statusCountsInRange = await Message.aggregate([
            {
                $match: {
                    message_date: {$gte: startDate},
                    ai_status: {$in: ['completed', 'failed', 'expired', 'canceled_by_user']}
                }
            },
            {
                $group: {
                    _id: '$ai_status',
                    count: {$sum: 1}
                }
            }
        ]);

        const statusMap = statusCountsInRange.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const completedMessages = statusMap.completed || 0;
        const failedMessages = statusMap.failed || 0;
        const expiredMessages = statusMap.expired || 0;
        const canceledByUserMessages = statusMap.canceled_by_user || 0;

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
                pendingPrefilterMessages: 0,
                messagesToday,
                validMessagesToday
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
        const {timeframe = '24h'} = req.query;
        const startDate = parseTimeframe(timeframe);

        dashboardLogger.info('Fetching messages chart data', {
            timeframe,
            startDate: startDate.toISOString()
        });


        const durationInDays = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        let truncateUnit = 'minute';

        if (durationInDays > 30) {
            truncateUnit = 'day';
        } else if (durationInDays > 2) {
            truncateUnit = 'hour';
        }

        const messages = await Message.aggregate([
            {
                $match: {message_date: {$gte: startDate}}
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
                    totalMessages: {$sum: 1},
                    validMessages: {
                        $sum: {$cond: ['$is_valid', 1, 0]}
                    },
                    lfgMessages: {
                        $sum: {$cond: ['$is_lfg', 1, 0]}
                    }
                }
            },
            {
                $sort: {'_id': 1}
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
        const {timeRange = '24h'} = req.query;
        const startDate = parseTimeframe(timeRange);

        dashboardLogger.info('Fetching AI status distribution', {
            timeRange,
            startDate: startDate.toISOString()
        });

        const distribution = await Message.aggregate([
            {
                $match: {message_date: {$gte: startDate}}
            },
            {
                $group: {
                    _id: '$ai_status',
                    count: {$sum: 1}
                }
            }
        ]);

        const filteredDistribution = distribution.filter(item => item._id !== 'pending_prefilter');

        // Add unknown status for messages without ai_status (null values)
        const unknownCount = await Message.countDocuments({
            ai_status: {$exists: false},
            message_date: {$gte: startDate}
        });
        if (unknownCount > 0) {
            filteredDistribution.push({_id: 'unknown', count: unknownCount});
        }

        dashboardLogger.info('AI status distribution generated', {
            timeRange,
            statuses: filteredDistribution.length
        });

        res.json(filteredDistribution);
    }),
};
