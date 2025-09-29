import express from 'express';
import playerRoutes from './players.js';
import messageRoutes from './messages.js';
import adminUserRoutes from './adminUsers.js';
import dashboardRoutes from './dashboard.js';
import deletedMessageRoutes from './deletedMessages.js';
import prefilterResultRoutes from './prefilterResults.js';
import gamingGroupRoutes from './gamingGroups.js';
import canceledUserRoutes from './canceledUsers.js';
import userMessageRoutes from './userMessages.js';
import userSeenRoutes from './userSeen.js';

const router = express.Router();

// Mount all routes
router.use('/players', playerRoutes);
router.use('/messages', messageRoutes);
router.use('/admin-users', adminUserRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/deleted-messages', deletedMessageRoutes);
router.use('/prefilter-results', prefilterResultRoutes);
router.use('/gaming-groups', gamingGroupRoutes);
router.use('/canceled-users', canceledUserRoutes);
router.use('/user-messages', userMessageRoutes);
router.use('/user-seen', userSeenRoutes);

export default router;