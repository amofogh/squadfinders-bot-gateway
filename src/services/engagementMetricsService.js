import { Message, MessageReaction, MESSAGE_REACTIONS, UserMessage, UserSeen } from '../models/index.js';
import { createServiceLogger } from '../utils/logger.js';

const metricsLogger = createServiceLogger('engagement-metrics');

const POSITIVE_REACTIONS = new Set(['👍', '❤️']);
const NEGATIVE_REACTIONS = new Set(['👎']);

const reactionSortOrder = {
  '❤️': 0,
  '👍': 1,
  '👎': 2
};

const sortBreakdown = (breakdown) => {
  return breakdown.slice().sort((a, b) => {
    const orderA = reactionSortOrder[a.reaction] ?? Number.MAX_SAFE_INTEGER;
    const orderB = reactionSortOrder[b.reaction] ?? Number.MAX_SAFE_INTEGER;
    if (orderA === orderB) {
      return a.reaction.localeCompare(b.reaction);
    }
    return orderA - orderB;
  });
};

const aggregateReactionBreakdown = async (matchFilter) => {
  const breakdown = await MessageReaction.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$reaction',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        reaction: '$_id',
        count: 1
      }
    }
  ]);

  let totalReactions = 0;
  let positiveReactions = 0;
  let negativeReactions = 0;

  for (const item of breakdown) {
    totalReactions += item.count;
    if (POSITIVE_REACTIONS.has(item.reaction)) {
      positiveReactions += item.count;
    }
    if (NEGATIVE_REACTIONS.has(item.reaction)) {
      negativeReactions += item.count;
    }
  }

  return {
    totalReactions,
    positiveReactions,
    negativeReactions,
    breakdown: sortBreakdown(breakdown)
  };
};

const buildReactionDateFilter = (start, end) => {
  if (!start && !end) {
    return undefined;
  }

  const filter = {};
  if (start) {
    filter.$gte = start;
  }
  if (end) {
    filter.$lte = end;
  }
  return filter;
};

const computeDeliveries = async (messageIds) => {
  if (!messageIds.length) {
    return { uniqueRecipients: 0, totalDeliveries: 0 };
  }

  const uniqueRecipients = await UserSeen.countDocuments({ message_ids: { $in: messageIds } });

  if (!uniqueRecipients) {
    return { uniqueRecipients: 0, totalDeliveries: 0 };
  }

  const [deliveriesResult] = await UserSeen.aggregate([
    { $match: { message_ids: { $in: messageIds } } },
    {
      $project: {
        message_ids: {
          $filter: {
            input: '$message_ids',
            as: 'mid',
            cond: { $in: ['$$mid', messageIds] }
          }
        }
      }
    },
    { $unwind: '$message_ids' },
    {
      $group: {
        _id: null,
        total: { $sum: 1 }
      }
    }
  ]);

  return {
    uniqueRecipients,
    totalDeliveries: deliveriesResult?.total ?? 0
  };
};

const toMessageId = (value) => {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const engagementMetricsService = {
  async recordReaction({ message_id, user_id, username, reaction, reacted_at, source, metadata }) {
    metricsLogger.info('Recording reaction', {
      message_id,
      user_id,
      reaction,
      source
    });

    const update = {
      username: username ?? null,
      reaction,
      reacted_at: reacted_at ?? new Date(),
      source: source ?? 'bot-crawler'
    };

    if (metadata && typeof metadata === 'object') {
      update.metadata = metadata;
    } else if (metadata === null) {
      update.metadata = null;
    }

    const reactionDoc = await MessageReaction.findOneAndUpdate(
      { message_id, user_id },
      {
        $set: update,
        $setOnInsert: {
          message_id,
          user_id
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return reactionDoc;
  },

  async listReactions({ page = 1, limit = 100, messageId, userId, reaction, source, start, end }) {
    const query = {};

    if (messageId !== undefined && messageId !== null) {
      const parsedMessageId = toMessageId(messageId);
      if (parsedMessageId !== null) {
        query.message_id = parsedMessageId;
      }
    }

    if (userId) {
      query.user_id = userId;
    }

    if (reaction && MESSAGE_REACTIONS.includes(reaction)) {
      query.reaction = reaction;
    }

    if (source) {
      query.source = source;
    }

    const dateFilter = buildReactionDateFilter(start, end);
    if (dateFilter) {
      query.reacted_at = dateFilter;
    }

    const skip = (page - 1) * limit;

    const [reactions, total] = await Promise.all([
      MessageReaction.find(query)
        .sort({ reacted_at: -1 })
        .skip(skip)
        .limit(limit),
      MessageReaction.countDocuments(query)
    ]);

    return {
      data: reactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  async getGlobalSummary({ start, end }) {
    const messageMatch = {};
    if (start || end) {
      messageMatch.message_date = {};
      if (start) {
        messageMatch.message_date.$gte = start;
      }
      if (end) {
        messageMatch.message_date.$lte = end;
      }
    }

    const messages = await Message.find(messageMatch, {
      message_id: 1,
      message_date: 1
    }).lean();

    const messageIds = messages.map((msg) => msg.message_id);

    if (!messageIds.length) {
      return {
        range: {
          start: start ? start.toISOString() : null,
          end: end ? end.toISOString() : null
        },
        totals: {
          messagesAnalyzed: 0,
          messagesWithReactions: 0,
          uniqueRecipients: 0,
          totalDeliveries: 0,
          totalReactions: 0,
          uniqueReactors: 0,
          positiveReactions: 0,
          negativeReactions: 0,
          neutralReactions: 0,
          netScore: 0
        },
        rates: {
          reactionPerDelivery: 0,
          reactionPerMessage: 0,
          uniqueEngagementRate: 0,
          positivityRate: 0,
          coverageRate: 0
        },
        breakdown: []
      };
    }

    const dateFilter = buildReactionDateFilter(start, end);
    const reactionMatch = {
      message_id: { $in: messageIds }
    };
    if (dateFilter) {
      reactionMatch.reacted_at = dateFilter;
    }

    const [breakdown, uniqueReactors, messagesWithReactions, deliveries] = await Promise.all([
      aggregateReactionBreakdown(reactionMatch),
      MessageReaction.distinct('user_id', reactionMatch),
      MessageReaction.distinct('message_id', reactionMatch),
      computeDeliveries(messageIds)
    ]);

    const neutralReactions = breakdown.totalReactions - breakdown.positiveReactions - breakdown.negativeReactions;

    return {
      range: {
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null
      },
      totals: {
        messagesAnalyzed: messageIds.length,
        messagesWithReactions: messagesWithReactions.length,
        uniqueRecipients: deliveries.uniqueRecipients,
        totalDeliveries: deliveries.totalDeliveries,
        totalReactions: breakdown.totalReactions,
        uniqueReactors: uniqueReactors.length,
        positiveReactions: breakdown.positiveReactions,
        negativeReactions: breakdown.negativeReactions,
        neutralReactions,
        netScore: breakdown.positiveReactions - breakdown.negativeReactions
      },
      rates: {
        reactionPerDelivery: deliveries.totalDeliveries ? breakdown.totalReactions / deliveries.totalDeliveries : 0,
        reactionPerMessage: messageIds.length ? breakdown.totalReactions / messageIds.length : 0,
        uniqueEngagementRate: deliveries.uniqueRecipients ? uniqueReactors.length / deliveries.uniqueRecipients : 0,
        positivityRate: breakdown.totalReactions ? breakdown.positiveReactions / breakdown.totalReactions : 0,
        coverageRate: messageIds.length ? messagesWithReactions.length / messageIds.length : 0
      },
      breakdown: breakdown.breakdown
    };
  },

  async getMessageSummary(messageId) {
    const numericMessageId = toMessageId(messageId);
    if (numericMessageId === null) {
      return null;
    }

    const message = await Message.findOne({ message_id: numericMessageId }).lean();

    if (!message) {
      return null;
    }

    const reactionMatch = { message_id: numericMessageId };

    const [breakdown, uniqueReactors, latestReaction, earliestReaction, deliveries] = await Promise.all([
      aggregateReactionBreakdown(reactionMatch),
      MessageReaction.distinct('user_id', reactionMatch),
      MessageReaction.findOne(reactionMatch).sort({ reacted_at: -1 }).select('reacted_at').lean(),
      MessageReaction.findOne(reactionMatch).sort({ reacted_at: 1 }).select('reacted_at').lean(),
      computeDeliveries([numericMessageId])
    ]);

    const neutralReactions = breakdown.totalReactions - breakdown.positiveReactions - breakdown.negativeReactions;

    return {
      message: {
        message_id: message.message_id,
        message_date: message.message_date,
        group: message.group,
        sender: message.sender,
        message: message.message
      },
      totals: {
        totalReactions: breakdown.totalReactions,
        uniqueReactors: uniqueReactors.length,
        positiveReactions: breakdown.positiveReactions,
        negativeReactions: breakdown.negativeReactions,
        neutralReactions,
        netScore: breakdown.positiveReactions - breakdown.negativeReactions,
        uniqueRecipients: deliveries.uniqueRecipients,
        totalDeliveries: deliveries.totalDeliveries
      },
      rates: {
        reactionPerDelivery: deliveries.totalDeliveries ? breakdown.totalReactions / deliveries.totalDeliveries : 0,
        uniqueEngagementRate: deliveries.uniqueRecipients ? uniqueReactors.length / deliveries.uniqueRecipients : 0,
        positivityRate: breakdown.totalReactions ? breakdown.positiveReactions / breakdown.totalReactions : 0
      },
      timeline: {
        firstReactionAt: earliestReaction?.reacted_at ?? null,
        lastReactionAt: latestReaction?.reacted_at ?? null
      },
      breakdown: breakdown.breakdown
    };
  },

  async getUserSummary(userId) {
    const reactionMatch = { user_id: userId };

    const [breakdown, userSeen, inboundMessages, distinctMessages, latestReaction, earliestReaction] = await Promise.all([
      aggregateReactionBreakdown(reactionMatch),
      UserSeen.findOne({ user_id: userId }).lean(),
      UserMessage.countDocuments({ user_id: userId }),
      MessageReaction.distinct('message_id', reactionMatch),
      MessageReaction.findOne(reactionMatch).sort({ reacted_at: -1 }).select('reacted_at').lean(),
      MessageReaction.findOne(reactionMatch).sort({ reacted_at: 1 }).select('reacted_at').lean()
    ]);

    const neutralReactions = breakdown.totalReactions - breakdown.positiveReactions - breakdown.negativeReactions;
    const messagesSeen = userSeen?.message_ids?.length ?? 0;

    return {
      user: {
        user_id: userId,
        username: userSeen?.username ?? null
      },
      totals: {
        totalReactions: breakdown.totalReactions,
        positiveReactions: breakdown.positiveReactions,
        negativeReactions: breakdown.negativeReactions,
        neutralReactions,
        netScore: breakdown.positiveReactions - breakdown.negativeReactions,
        messagesReacted: distinctMessages.length,
        inboundMessages
      },
      reach: {
        messagesSeen,
        reactionRate: messagesSeen ? distinctMessages.length / messagesSeen : 0
      },
      timeline: {
        firstReactionAt: earliestReaction?.reacted_at ?? null,
        lastReactionAt: latestReaction?.reacted_at ?? null
      },
      breakdown: breakdown.breakdown
    };
  }
};
