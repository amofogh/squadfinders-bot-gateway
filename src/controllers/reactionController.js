import { engagementMetricsService } from '../services/engagementMetricsService.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { createServiceLogger } from '../utils/logger.js';
import { parseDateInput, resolveTimeRange } from '../utils/timeRange.js';
import { validateMessageId } from '../utils/validators.js';
import { MESSAGE_REACTIONS } from '../models/MessageReaction.js';

const reactionLogger = createServiceLogger('reaction-controller');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

const parsePagination = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const reactionController = {
  create: handleAsyncError(async (req, res) => {
    const { message_id, user_id, username, reaction, reacted_at, source, metadata } = req.body;

    if (!validateMessageId(message_id)) {
      return res.status(400).json({ error: 'message_id must be an integer' });
    }

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: 'user_id is required' });
    }

    if (!reaction || !MESSAGE_REACTIONS.includes(reaction)) {
      return res.status(400).json({ error: `reaction must be one of ${MESSAGE_REACTIONS.join(', ')}` });
    }

    let reactionDate = undefined;
    if (reacted_at) {
      const parsedDate = parseDateInput(reacted_at);
      if (!parsedDate) {
        return res.status(400).json({ error: 'reacted_at must be a valid ISO date' });
      }
      reactionDate = parsedDate;
    }

    if (metadata && typeof metadata !== 'object') {
      return res.status(400).json({ error: 'metadata must be an object if provided' });
    }

    const recorded = await engagementMetricsService.recordReaction({
      message_id: Number.parseInt(message_id, 10),
      user_id,
      username,
      reaction,
      reacted_at: reactionDate,
      source,
      metadata: metadata ?? null
    });

    reactionLogger.info('Reaction recorded', {
      message_id: recorded.message_id,
      user_id: recorded.user_id,
      reaction: recorded.reaction
    });

    res.status(201).json(recorded);
  }),

  list: handleAsyncError(async (req, res) => {
    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      message_id,
      user_id,
      reaction,
      source,
      since,
      until
    } = req.query;

    const resolvedPage = parsePagination(page, DEFAULT_PAGE);
    const resolvedLimit = parsePagination(limit, DEFAULT_LIMIT);

    if (message_id !== undefined && message_id !== null && message_id !== '') {
      if (!validateMessageId(message_id)) {
        return res.status(400).json({ error: 'message_id must be an integer' });
      }
    }

    if (reaction && !MESSAGE_REACTIONS.includes(reaction)) {
      return res.status(400).json({ error: `reaction must be one of ${MESSAGE_REACTIONS.join(', ')}` });
    }

    let start = null;
    let end = null;

    if (since || until) {
      start = parseDateInput(since);
      end = parseDateInput(until);

      if ((since && !start) || (until && !end) || (start && end && start > end)) {
        return res.status(400).json({ error: 'Invalid date range supplied' });
      }
    }

    const data = await engagementMetricsService.listReactions({
      page: resolvedPage,
      limit: resolvedLimit,
      messageId: message_id,
      userId: user_id,
      reaction,
      source,
      start,
      end
    });

    res.json(data);
  }),

  getSummary: handleAsyncError(async (req, res) => {
    const { timeframe, since, until } = req.query;

    let range = null;

    if (since || until) {
      const start = parseDateInput(since);
      const end = parseDateInput(until);
      if ((since && !start) || (until && !end) || (start && end && start > end)) {
        return res.status(400).json({ error: 'Invalid date range supplied' });
      }
      range = { start: start ?? null, end: end ?? null };
    } else {
      range = resolveTimeRange({ timeframe });
      if (!range) {
        return res.status(400).json({ error: 'Invalid timeframe supplied' });
      }
    }

    const summary = await engagementMetricsService.getGlobalSummary({
      start: range.start,
      end: range.end
    });

    res.json(summary);
  }),

  getMessageSummary: handleAsyncError(async (req, res) => {
    const { messageId } = req.params;

    if (!validateMessageId(messageId)) {
      return res.status(400).json({ error: 'messageId must be an integer' });
    }

    const summary = await engagementMetricsService.getMessageSummary(Number.parseInt(messageId, 10));

    if (!summary) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(summary);
  }),

  getUserSummary: handleAsyncError(async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const summary = await engagementMetricsService.getUserSummary(userId);
    res.json(summary);
  })
};
