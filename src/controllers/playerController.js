import { Player, CanceledUser } from '../models/index.js';
import { UserSeen, UserAnalytics } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateObjectId, validateMessageId } from '../utils/validators.js';
import { createServiceLogger } from '../utils/logger.js';
import createCsvWriter from 'csv-writer';
import { promises as fs } from 'fs';
import path from 'path';
import { recordPlayer } from '../services/analyticsService.js';

const playerLogger = createServiceLogger('player-controller');

export const playerController = {
  // Get all players with filtering and pagination
  getAll: handleAsyncError(async (req, res) => {
    const { active, platform, page = 1, limit = 100 } = req.query;
    const query = {};

    if (active !== undefined) query.active = active === 'true';
    if (platform) query.platform = platform;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    playerLogger.info('Fetching players', {
      active,
      platform,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    const [players, total] = await Promise.all([
      Player.find(query)
        .sort({ message_date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Player.countDocuments(query)
    ]);

    res.json({
      data: players,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  }),

  // Get active players for squad (excluding seen ones)
  getPlayersForSquad: handleAsyncError(async (req, res) => {
    const { user_id, limit = 50 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id query parameter is required' });
    }

    const maxLimit = Math.min(parseInt(limit), 100);

    playerLogger.info('Fetching players for squad', {
      userId: user_id,
      requestedLimit: limit,
      resolvedLimit: maxLimit
    });
    
    // Get user's seen message IDs
    const userSeen = await UserSeen.findOne({ 
      user_id: user_id, 
      active: true 
    });
    
    const seenMessageIds = userSeen ? userSeen.message_ids : [];
    
    // Find active players excluding those with message_ids in seen list
    const players = await Player.find({
      active: true,
      message_id: { $nin: seenMessageIds },
      'sender.id': { $ne: user_id }
    })
    .sort({ message_date: -1 })
    .limit(maxLimit);

    res.json({
      data: players,
      count: players.length,
      excluded_seen_count: seenMessageIds.length,
      user_id: user_id
    });
  }),
  // Get player by ID or message_id
  getById: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    let player;

    if (validateObjectId(id)) {
      player = await Player.findById(id);
    } else if (validateMessageId(id)) {
      player = await Player.findOne({ message_id: parseInt(id, 10) });
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  }),

  // Create new player
  create: handleAsyncError(async (req, res) => {
    const { sender, group } = req.body;

    playerLogger.info('Attempting to create player', {
      senderId: sender?.id,
      senderUsername: sender?.username,
      groupId: group?.group_id,
      groupUsername: group?.group_username
    });


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
          playerLogger.warn('Blocked player creation for canceled user', {
            senderId: sender?.id,
            senderUsername: sender?.username
          });

          return res.status(409).json({
            error: 'Cannot create player for a canceled user',
            user_id: sender?.id || null,
            username: sender?.username || null
          });
        }
      }
    }

    // Check if sender and group information is provided
    if (sender && sender.id && group && group.group_id) {
      // Deactivate all existing active players for this sender in this group
      const updateResult = await Player.updateMany(
        {
          'sender.id': sender.id,
          'group.group_id': group.group_id,
          active: true
        },
        {
          $set: { active: false }
        }
      );

      playerLogger.info('Deactivated existing players for sender in group', {
        senderId: sender.id,
        groupId: group.group_id,
        deactivatedCount: updateResult.modifiedCount || 0
      });
    }

    const player = new Player(req.body);
    player.active = true;
    await player.save();
    
    // Record analytics
    if (sender?.id) {
      await recordPlayer(sender.id, player.message_date);
      
      // Update username in analytics if provided
      if (sender.username) {
        await UserAnalytics.updateOne(
          { user_id: sender.id },
          { $set: { username: sender.username } }
        );
      }
    }

    playerLogger.info('Player created successfully', {
      playerId: player._id.toString(),
      messageId: player.message_id,
      senderId: sender?.id,
      groupId: group?.group_id
    });
    res.status(201).json(player);
  }),

  // Update player
  update: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    let player;

    if (validateObjectId(id)) {
      player = await Player.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true
      });
    } else if (validateMessageId(id)) {
      player = await Player.findOneAndUpdate(
        { message_id: parseInt(id, 10) },
        req.body,
        { new: true, runValidators: true }
      );
    }

    if (!player) {
      playerLogger.warn('Player not found for update', { id });
      return res.status(404).json({ error: 'Player not found' });
    }

    playerLogger.info('Player updated successfully', {
      id,
      playerId: player._id.toString()
    });

    res.json(player);
  }),

  // Delete player
  delete: handleAsyncError(async (req, res) => {
    const { id } = req.params;
    let player;

    if (validateObjectId(id)) {
      player = await Player.findByIdAndDelete(id);
    } else if (validateMessageId(id)) {
      player = await Player.findOneAndDelete({ message_id: parseInt(id, 10) });
    }

    if (!player) {
      playerLogger.warn('Player not found for deletion', { id });
      return res.status(404).json({ error: 'Player not found' });
    }

    playerLogger.info('Player deleted successfully', {
      id,
      playerId: player._id.toString()
    });

    res.json({ message: 'Player deleted successfully' });
  })
};
