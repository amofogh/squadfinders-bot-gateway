import { BotUserStat, BUTTON_CATEGORIES } from '../models/BotUserStat.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { createServiceLogger } from '../utils/logger.js';

const botStatsLogger = createServiceLogger('bot-user-stats-controller');

const buildButtonFilterQuery = (button) => {
  if (!button) {
    return {};
  }

  if (!BUTTON_CATEGORIES.includes(button)) {
    return null;
  }

  return {
    [`button_totals.${button}.count`]: { $gt: 0 }
  };
};

export const botUserStatController = {
  getAll: handleAsyncError(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      search,
      button
    } = req.query;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    const buttonQuery = buildButtonFilterQuery(button);
    if (buttonQuery === null) {
      return res.status(400).json({
        error: 'Invalid button filter provided',
        allowed_buttons: BUTTON_CATEGORIES
      });
    }

    Object.assign(query, buttonQuery);

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { username: regex },
        { full_name: regex },
        { user_id: regex }
      ];
    }

    botStatsLogger.info('Fetching bot user stats list', {
      page: parsedPage,
      limit: parsedLimit,
      search,
      button
    });

    const [data, total] = await Promise.all([
      BotUserStat.find(query)
        .sort({ last_interaction_at: -1, updatedAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      BotUserStat.countDocuments(query)
    ]);

    res.json({
      data,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    });
  }),

  getByUserId: handleAsyncError(async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    botStatsLogger.info('Fetching bot user stats', { user_id });

    const stat = await BotUserStat.findOne({ user_id }).lean();

    if (!stat) {
      return res.status(404).json({ error: 'Bot user stats not found' });
    }

    res.json(stat);
  }),

  recordInteraction: handleAsyncError(async (req, res) => {
    const {
      user_id,
      username,
      full_name,
      button,
      occurred_at
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    if (!button || !BUTTON_CATEGORIES.includes(button)) {
      return res.status(400).json({
        error: 'button is required and must be a valid category',
        allowed_buttons: BUTTON_CATEGORIES
      });
    }

    const at = occurred_at ? new Date(occurred_at) : new Date();
    if (Number.isNaN(at.getTime())) {
      return res.status(400).json({ error: 'occurred_at must be a valid date' });
    }

    botStatsLogger.info('Recording bot user interaction', {
      user_id,
      button
    });

    const update = {
      $inc: {
        total_interactions: 1,
        [`button_totals.${button}.count`]: 1
      },
      $set: {
        last_interaction_at: at,
        last_button: button,
        [`button_totals.${button}.last_at`]: at
      },
      $setOnInsert: {
        first_interaction_at: at
      },
      $push: {
        history: {
          $each: [{ button, at }],
          $slice: -100
        }
      }
    };

    if (username !== undefined) {
      update.$set.username = username;
    }

    if (full_name !== undefined) {
      update.$set.full_name = full_name;
    }

    const stat = await BotUserStat.findOneAndUpdate(
      { user_id },
      update,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    res.status(201).json(stat);
  }),

  getSummary: handleAsyncError(async (req, res) => {
    botStatsLogger.info('Fetching bot user stats summary');

    const summaryAggregation = await BotUserStat.aggregate([
      {
        $group: {
          _id: null,
          total_users: { $sum: 1 },
          total_interactions: { $sum: '$total_interactions' },
          ...BUTTON_CATEGORIES.reduce((acc, button) => {
            acc[`button_${button}`] = {
              $sum: {
                $ifNull: [`$button_totals.${button}.count`, 0]
              }
            };
            return acc;
          }, {})
        }
      },
      {
        $project: BUTTON_CATEGORIES.reduce((acc, button) => {
          acc[button] = `$button_${button}`;
          return acc;
        }, {
          _id: 0,
          total_users: 1,
          total_interactions: 1
        })
      }
    ]);

    const summary = summaryAggregation[0] || {
      total_users: 0,
      total_interactions: 0,
      ...BUTTON_CATEGORIES.reduce((acc, button) => {
        acc[button] = 0;
        return acc;
      }, {})
    };

    res.json(summary);
  })
};

