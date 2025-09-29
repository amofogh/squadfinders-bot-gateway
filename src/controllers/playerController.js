import { Player } from '../models/index.js';
import { UserSeen } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';
import { validateObjectId, validateMessageId } from '../utils/validators.js';
import createCsvWriter from 'csv-writer';
import { promises as fs } from 'fs';
import path from 'path';

export const playerController = {
  // Get all players with filtering and pagination
  getAll: handleAsyncError(async (req, res) => {
    const { active, platform, page = 1, limit = 100 } = req.query;
    const query = {};
    
    if (active !== undefined) query.active = active === 'true';
    if (platform) query.platform = platform;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
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
    
    // Check if sender and group information is provided
    if (sender && sender.id && group && group.group_id) {
      // Deactivate all existing active players for this sender in this group
      await Player.updateMany(
        {
          'sender.id': sender.id,
          'group.group_id': group.group_id,
          active: true
        },
        {
          $set: { active: false }
        }
      );
      
      console.log(`Deactivated existing players for sender ${sender.id} in group ${group.group_id}`);
    }
    
    const player = new Player(req.body);
    player.active = true;
    await player.save();
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
      return res.status(404).json({ error: 'Player not found' });
    }

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
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Player deleted successfully' });
  })
};