import { UserStats } from '../models/index.js';
import { handleAsyncError } from '../utils/errorHandler.js';

const BUTTON_NAMES = {
    'find_player': 'find_player',
    'dont_want_to_play': 'dont_want_to_play',
    'about_us': 'about_us',
    'channel_and_group': 'channel_and_group'
};

export const userStatsController = {
    // Get all user stats with pagination
    getAll: handleAsyncError(async (req, res) => {
        const { page = 1, limit = 100, user_id, username } = req.query;
        const query = {};

        if (user_id) query.user_id = user_id;
        if (username) query.username = username;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [stats, total] = await Promise.all([
            UserStats.find(query)
                .sort({ total_clicks: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            UserStats.countDocuments(query)
        ]);

        res.json({
            data: stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }),

    // Get user stats by user_id
    getByUserId: handleAsyncError(async (req, res) => {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const stats = await UserStats.findOne({ user_id });

        if (!stats) {
            return res.status(404).json({ error: 'User stats not found' });
        }

        res.json(stats);
    }),

    // Record a button click
    recordClick: handleAsyncError(async (req, res) => {
        const { user_id, username, button_name } = req.body;

        // Require either user_id or username
        if (!user_id && !username) {
            return res.status(400).json({
                error: 'Either user_id or username is required'
            });
        }

        if (!button_name) {
            return res.status(400).json({ error: 'button_name is required' });
        }

        // Validate button name
        const buttonKey = BUTTON_NAMES[button_name];
        if (!buttonKey) {
            return res.status(400).json({
                error: 'Invalid button_name',
                valid_buttons: Object.keys(BUTTON_NAMES)
            });
        }

        // Find user stats - prefer user_id if provided, otherwise search by username
        let stats = null;

        if (user_id) {
            // If user_id is provided, use it (most reliable)
            stats = await UserStats.findOne({ user_id });
        } else if (username) {
            // If only username is provided, find by username
            stats = await UserStats.findOne({ username });
        }

        // If stats not found, create new record
        if (!stats) {
            // For new records, user_id is required (it's the unique identifier)
            if (!user_id) {
                return res.status(400).json({
                    error: 'user_id is required for new user records. Please provide user_id when creating a new user stat entry.',
                    suggestion: 'If this is a new user, include both username and user_id in your request.'
                });
            }

            stats = new UserStats({
                user_id,
                username: username || null,
                button_clicks: {
                    find_player: { count: 0, last_clicked_at: null },
                    dont_want_to_play: { count: 0, last_clicked_at: null },
                    about_us: { count: 0, last_clicked_at: null },
                    channel_and_group: { count: 0, last_clicked_at: null }
                },
                total_clicks: 0
            });
        } else {
            // Update username if provided and different
            if (username && stats.username !== username) {
                stats.username = username;
            }
            // Update user_id if provided and different (shouldn't happen, but handle it)
            if (user_id && stats.user_id !== user_id) {
                // Check if the new user_id already exists
                const existingWithNewId = await UserStats.findOne({ user_id });
                if (existingWithNewId) {
                    return res.status(409).json({
                        error: 'A user stat record with this user_id already exists',
                        existing_user_id: user_id
                    });
                }
                stats.user_id = user_id;
            }
        }

        // Increment button click count
        stats.button_clicks[buttonKey].count += 1;
        stats.button_clicks[buttonKey].last_clicked_at = new Date();
        stats.total_clicks += 1;

        await stats.save();

        res.status(200).json({
            success: true,
            data: stats,
            message: 'Button click recorded successfully'
        });
    }),

    // Create new user stats (Admin only)
    create: handleAsyncError(async (req, res) => {
        const { user_id, username, button_clicks } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Check if user stats already exists
        const existing = await UserStats.findOne({ user_id });
        if (existing) {
            return res.status(409).json({
                error: 'User stats already exists',
                data: existing
            });
        }

        const stats = new UserStats({
            user_id,
            username: username || null,
            button_clicks: button_clicks || {
                find_player: { count: 0, last_clicked_at: null },
                dont_want_to_play: { count: 0, last_clicked_at: null },
                about_us: { count: 0, last_clicked_at: null },
                channel_and_group: { count: 0, last_clicked_at: null }
            },
            total_clicks: 0
        });

        await stats.save();
        res.status(201).json(stats);
    }),

    // Update user stats by user_id
    updateByUserId: handleAsyncError(async (req, res) => {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const stats = await UserStats.findOneAndUpdate({ user_id }, req.body, {
            new: true,
            runValidators: true
        });

        if (!stats) {
            return res.status(404).json({ error: 'User stats not found' });
        }

        res.json(stats);
    }),

    // Delete user stats by user_id
    deleteByUserId: handleAsyncError(async (req, res) => {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        const stats = await UserStats.findOneAndDelete({ user_id });

        if (!stats) {
            return res.status(404).json({ error: 'User stats not found' });
        }

        res.json({
            message: 'User stats deleted successfully',
            deleted_at: new Date()
        });
    }),

    // Get aggregated stats (top users, etc.)
    getAggregated: handleAsyncError(async (req, res) => {
        const { limit = 10 } = req.query;

        const topUsers = await UserStats.find()
            .sort({ total_clicks: -1 })
            .limit(parseInt(limit))
            .select('user_id username total_clicks button_clicks');

        const totalStats = await UserStats.aggregate([
            {
                $group: {
                    _id: null,
                    total_users: { $sum: 1 },
                    total_clicks: { $sum: '$total_clicks' },
                    find_player_clicks: { $sum: '$button_clicks.find_player.count' },
                    dont_want_to_play_clicks: { $sum: '$button_clicks.dont_want_to_play.count' },
                    about_us_clicks: { $sum: '$button_clicks.about_us.count' },
                    channel_and_group_clicks: { $sum: '$button_clicks.channel_and_group.count' }
                }
            }
        ]);

        res.json({
            top_users: topUsers,
            summary: totalStats[0] || {
                total_users: 0,
                total_clicks: 0,
                find_player_clicks: 0,
                dont_want_to_play_clicks: 0,
                about_us_clicks: 0,
                channel_and_group_clicks: 0
            }
        });
    })
};

