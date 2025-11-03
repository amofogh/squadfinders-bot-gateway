import {Player, CanceledUser} from '../models/index.js';
import {UserSeen, UserAnalytics} from '../models/index.js';
import {handleAsyncError} from '../utils/errorHandler.js';
import {validateMessageId} from '../utils/validators.js';
import {createServiceLogger} from '../utils/logger.js';
import {recordPlayer} from '../services/analyticsService.js';
import {config} from '../config/index.js';


const playerLogger = createServiceLogger('player-controller');


const playerSpamInterval = Number(config.playerSpam.timeoutHours)

export const playerController = {
    // Get all players with filtering and pagination
    getAll: handleAsyncError(async (req, res) => {
        const {
            active,
            platform,
            page = 1,
            limit = 100,
            user_id,
            time
        } = req.query;
        const query = {};

        if (active !== undefined) query.active = active === 'true';
        if (platform) query.platform = platform;
        if (user_id) query['sender.id'] = user_id;

        let minutesFilter = null;
        if (time !== undefined) {
            const parsedMinutes = parseInt(time, 10);

            if (Number.isNaN(parsedMinutes) || parsedMinutes < 0) {
                return res.status(400).json({error: 'time must be a non-negative integer representing minutes'});
            }

            minutesFilter = parsedMinutes;
            const thresholdDate = new Date(Date.now() - parsedMinutes * 60 * 1000);
            query.message_date = {
                ...(query.message_date || {}),
                $gte: thresholdDate
            };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        playerLogger.info('Fetching players', {
            active,
            platform,
            userId: user_id,
            minutesFilter,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        const [players, total] = await Promise.all([
            Player.find(query)
                .sort({message_date: -1})
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
        const {user_id, limit = 50} = req.query;

        if (!user_id) {
            return res.status(400).json({error: 'user_id query parameter is required'});
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
            message_id: {$nin: seenMessageIds},
            'sender.id': {$ne: user_id}
        })
            .sort({message_date: -1})
            .limit(maxLimit);

        res.json({
            data: players,
            count: players.length,
            excluded_seen_count: seenMessageIds.length,
            user_id: user_id
        });
    }),

    // Deactivate all active players by sender_id
    deactivateBySenderId: handleAsyncError(async (req, res) => {
        const {sender_id} = req.body;

        if (!sender_id) {
            return res.status(400).json({error: 'sender_id is required'});
        }

        playerLogger.info('Deactivating players for sender', {senderId: sender_id});

        const updateResult = await Player.updateMany(
            {
                'sender.id': sender_id,
                active: true
            },
            {
                $set: {active: false}
            }
        );

        playerLogger.info('Deactivated players for sender', {
            senderId: sender_id,
            matchedCount: updateResult.matchedCount || 0,
            modifiedCount: updateResult.modifiedCount || 0
        });

        res.json({
            sender_id,
            matched_count: updateResult.matchedCount || 0,
            modified_count: updateResult.modifiedCount || 0
        });
    }),
    // Get player by message_id
    getByMessageId: handleAsyncError(async (req, res) => {
        const {message_id} = req.params;

        if (!validateMessageId(message_id)) {
            return res.status(400).json({error: 'Invalid message ID'});
        }

        const player = await Player.findOne({message_id: parseInt(message_id, 10)});

        if (!player) {
            return res.status(404).json({error: 'Player not found'});
        }

        res.json(player);
    }),

    // Create new player
    create: handleAsyncError(async (req, res) => {
        const {sender, group} = req.body;

        playerLogger.info('Attempting to create player', {
            senderId: sender?.id,
            senderUsername: sender?.username,
            groupId: group?.group_id,
            groupUsername: group?.group_username
        });


        if (sender?.id) {
            const threeHoursAgo = new Date(Date.now() - playerSpamInterval * 60 * 60 * 1000);
            const recentPlayer = await Player.findOne({
                'sender.id': sender.id,
                createdAt: {$gte: threeHoursAgo}
            });

            if (recentPlayer) {
                const nextAllowedAt = new Date(recentPlayer.createdAt.getTime() + 5 * 60 * 1000);
                const retryAfterSeconds = Math.max(
                    0,
                    Math.ceil((nextAllowedAt.getTime() - Date.now()) / 1000)
                );

                playerLogger.warn('Blocked player creation due to recent activity', {
                    senderId: sender.id,
                    recentMessageId: recentPlayer.message_id,
                    recentCreatedAt: recentPlayer.createdAt
                });

                return res.status(429).json({
                    error: 'Player was recently created for this user. Please wait before adding again.',
                    user_id: sender.id,
                    recent_message_id: recentPlayer.message_id,
                    retry_after_seconds: retryAfterSeconds
                });
            }
        }

        if (sender?.id || sender?.username) {
            const cancellationQuery = [];
            if (sender?.id) {
                cancellationQuery.push({user_id: sender.id});
            }
            if (sender?.username) {
                cancellationQuery.push({username: sender.username});
            }

            if (cancellationQuery.length > 0) {
                const canceledUser = await CanceledUser.findOne({$or: cancellationQuery});

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
                    active: true
                },
                {
                    $set: {active: false}
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
                    {user_id: sender.id},
                    {$set: {username: sender.username}}
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

    // Update player by message_id
    updateByMessageId: handleAsyncError(async (req, res) => {
        const {message_id} = req.params;

        if (!validateMessageId(message_id)) {
            return res.status(400).json({error: 'Invalid message ID'});
        }

        const player = await Player.findOneAndUpdate(
            {message_id: parseInt(message_id, 10)},
            req.body,
            {new: true, runValidators: true}
        );

        if (!player) {
            playerLogger.warn('Player not found for update', {message_id});
            return res.status(404).json({error: 'Player not found'});
        }

        playerLogger.info('Player updated successfully', {
            message_id,
            playerId: player._id.toString()
        });

        res.json(player);
    }),

    // Delete player by message_id
    deleteByMessageId: handleAsyncError(async (req, res) => {
        const {message_id} = req.params;

        if (!validateMessageId(message_id)) {
            return res.status(400).json({error: 'Invalid message ID'});
        }

        const player = await Player.findOneAndDelete({message_id: parseInt(message_id, 10)});

        if (!player) {
            playerLogger.warn('Player not found for deletion', {message_id});
            return res.status(404).json({error: 'Player not found'});
        }

        playerLogger.info('Player deleted successfully', {
            message_id,
            playerId: player._id.toString()
        });

        res.json({message: 'Player deleted successfully'});
    })
};
