import { Player } from '../models/Player.js';
import { Reaction } from '../models/Reaction.js';
import { UserAnalytics } from '../models/UserAnalytics.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { createServiceLogger } from '../utils/logger.js';

const statsLogger = createServiceLogger('stats-controller');

export const statsController = {
  // Get user analytics by ID
  getUserStats: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    
    statsLogger.info('Fetching user stats', { user_id: id });
    
    let userAnalytics = await UserAnalytics.findOne({ user_id: id });
    
    if (!userAnalytics) {
      // Create new analytics record if it doesn't exist
      userAnalytics = new UserAnalytics({ user_id: id });
      await userAnalytics.save();
      statsLogger.info('Created new user analytics record', { user_id: id });
    }
    
    res.json(userAnalytics);
  }),

  // Get global insights
  getInsights: handleAsyncError(async (req, res) => {
    statsLogger.info('Fetching global insights');
    
    const [insights, playerTotals, totalReactionsCount] = await Promise.all([
      UserAnalytics.aggregate([
        {
          $group: {
            _id: null,
            total_users: { $sum: 1 },
            avg_dm_sent: { $avg: '$dm.total_sent' },
            avg_lost_due_cancel: { $avg: '$dm.total_skipped_canceled' },
            avg_msgs: { $avg: '$messages.total' },
            avg_reacts: { $avg: '$reactions.total' },
            total_reactions: { $sum: '$reactions.total' },
            avg_player: { $avg: '$player.count' },
            canceled_users: {
              $sum: {
                $cond: ['$is_canceled', 1, 0]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            total_users: 1,
            avg_dm_sent: { $round: ['$avg_dm_sent', 2] },
            avg_lost_due_cancel: { $round: ['$avg_lost_due_cancel', 2] },
            avg_msgs: { $round: ['$avg_msgs', 2] },
            avg_reacts: { $round: ['$avg_reacts', 2] },
            total_reactions: 1,
            avg_player: { $round: ['$avg_player', 2] },
            cancel_rate: {
              $round: [
                { $divide: ['$canceled_users', '$total_users'] },
                4
              ]
            },
            canceled_users: 1
          }
        }
      ]),
      Player.aggregate([
        {
          $group: {
            _id: null,
            total_players_count: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ['$players_count', 0] }, 0] },
                  '$players_count',
                  0
                ]
              }
            }
          }
        }
      ]),
      Reaction.countDocuments()
    ]);

    const result = {
      total_players_count: playerTotals[0]?.total_players_count || 0,
      ...(insights[0] || {
        total_users: 0,
        avg_dm_sent: 0,
        avg_lost_due_cancel: 0,
        avg_msgs: 0,
        avg_reacts: 0,
        total_reactions: 0,
        avg_player: 0,
        cancel_rate: 0,
        canceled_users: 0
      })
    };

    result.total_reactions = totalReactionsCount || 0;

    res.json(result);
  }),

  // Get daily aggregates
  getDailyStats: handleAsyncError(async (req, res) => {
    const { days = 30 } = req.query;
    
    statsLogger.info('Fetching daily stats', { days });
    
    const dailyStats = await UserAnalytics.aggregate([
      { $unwind: '$daily' },
      {
        $group: {
          _id: '$daily.date',
          total_msgs: { $sum: '$daily.msgs' },
          total_reacts: { $sum: '$daily.reacts' },
          total_dms_sent: { $sum: '$daily.dms_sent' },
          total_dms_skipped: { $sum: '$daily.dms_skipped_canceled' },
          total_became_player: { $sum: '$daily.became_player' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: parseInt(days) }
    ]);
    
    res.json(dailyStats);
  })
};