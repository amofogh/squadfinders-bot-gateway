import { UserSeen, Player } from '../models/index.js';
import { config } from '../config/index.js';
import { logCleanup, logError } from '../utils/logger.js';

export class CleanupService {
  constructor() {
    this.userSeenIntervalId = null;
    this.playerIntervalId = null;
    this.isUserSeenRunning = false;
    this.isPlayerRunning = false;
  }

  // Start all cleanup services
  startAll() {
    this.startUserSeenCleanup();
    this.startPlayerCleanup();
  }

  // Stop all cleanup services
  stopAll() {
    this.stopUserSeenCleanup();
    this.stopPlayerCleanup();
  }

  // Start UserSeen cleanup service
  startUserSeenCleanup() {
    if (!config.userSeenCleanup.enabled) {
      logCleanup('UserSeen cleanup service disabled', {
        reason: 'USER_SEEN_CLEANUP_ENABLED is false'
      });
      return;
    }

    if (this.isUserSeenRunning) {
      logCleanup('UserSeen cleanup service already running');
      return;
    }

    const intervalMinutes = config.userSeenCleanup.intervalMinutes;
    console.log('intervalMinutes', intervalMinutes);
    logCleanup('Starting UserSeen cleanup service', {
      intervalMinutes,
      disableAfterMinutes: config.userSeenCleanup.disableAfterMinutes
    });

    this.userSeenIntervalId = setInterval(async () => {
      await this.cleanupUserSeen();
    }, intervalMinutes * 60 * 1000);

    this.isUserSeenRunning = true;

    // Run immediately on start
    this.cleanupUserSeen();
  }

  // Stop UserSeen cleanup service
  stopUserSeenCleanup() {
    if (this.userSeenIntervalId) {
      logCleanup('UserSeen cleanup service stopped');
      clearInterval(this.userSeenIntervalId);
      this.userSeenIntervalId = null;
      this.isUserSeenRunning = false;
    }
  }

  // Start Player cleanup service
  startPlayerCleanup() {
    if (!config.playerCleanup.enabled) {
      logCleanup('Player cleanup service disabled', {
        reason: 'PLAYER_CLEANUP_ENABLED is false'
      });
      return;
    }

    if (this.isPlayerRunning) {
      logCleanup('Player cleanup service already running');
      return;
    }

    const intervalMinutes = config.playerCleanup.intervalMinutes;
    console.log('intervalMinutes', intervalMinutes);

    logCleanup('Starting Player cleanup service', {
      intervalMinutes,
      disableAfterMinutes: config.playerCleanup.disableAfterMinutes
    });

    this.playerIntervalId = setInterval(async () => {
      await this.cleanupPlayers();
    }, intervalMinutes * 60 * 1000);

    this.isPlayerRunning = true;

    // Run immediately on start
    this.cleanupPlayers();
  }

  // Stop Player cleanup service
  stopPlayerCleanup() {
    if (this.playerIntervalId) {
      logCleanup('Player cleanup service stopped');
      clearInterval(this.playerIntervalId);
      this.playerIntervalId = null;
      this.isPlayerRunning = false;
    }
  }

  // Delete UserSeen records older than configured minutes
  async cleanupUserSeen() {
    if (!config.userSeenCleanup.enabled) return;

    try {
      const cutoffTime = new Date(Date.now() - config.userSeenCleanup.disableAfterMinutes * 60 * 1000);

      console.log('🧹 UserSeen cleanup running at:', new Date().toISOString());
      console.log('   Config:', {
        disableAfterMinutes: config.userSeenCleanup.disableAfterMinutes,
        intervalMinutes: config.userSeenCleanup.intervalMinutes
      });
      console.log('   Will delete records older than:', cutoffTime.toISOString());

      logCleanup('Starting UserSeen cleanup', {
        cutoffTime: cutoffTime.toISOString(),
        disableAfterMinutes: config.userSeenCleanup.disableAfterMinutes
      });

      // Delete old UserSeen records entirely
      const result = await UserSeen.deleteMany({
        updatedAt: { $lt: cutoffTime }
      });

      console.log('   Result: Deleted', result.deletedCount, 'records');

      if (result.deletedCount > 0) {
        logCleanup('UserSeen cleanup completed', {
          deletedCount: result.deletedCount,
          disableAfterMinutes: config.userSeenCleanup.disableAfterMinutes,
          cutoffTime: cutoffTime.toISOString()
        });
      } else {
        logCleanup('UserSeen cleanup - no records to delete', {
          cutoffTime: cutoffTime.toISOString()
        });
      }
    } catch (error) {
      console.error('❌ UserSeen cleanup error:', error);
      logError(error, {
        service: 'cleanup',
        action: 'cleanupUserSeen',
        config: config.userSeenCleanup
      });
    }
  }

  // Disable Players with message_date older than configured minutes
  async cleanupPlayers() {
    if (!config.playerCleanup.enabled) return;

    try {
      const cutoffTime = new Date(Date.now() - config.playerCleanup.disableAfterMinutes * 60 * 1000);

      logCleanup('Starting Player cleanup', {
        cutoffTime: cutoffTime.toISOString(),
        disableAfterMinutes: config.playerCleanup.disableAfterMinutes
      });

      const result = await Player.updateMany(
        {
          active: true,
          message_date: { $lt: cutoffTime }
        },
        {
          $set: { active: false }
        }
      );

      if (result.modifiedCount > 0) {
        logCleanup('Player cleanup completed', {
          disabledCount: result.modifiedCount,
          disableAfterMinutes: config.playerCleanup.disableAfterMinutes,
          cutoffTime: cutoffTime.toISOString()
        });
      } else {
        logCleanup('Player cleanup - no records to disable', {
          cutoffTime: cutoffTime.toISOString()
        });
      }
    } catch (error) {
      logError(error, {
        service: 'cleanup',
        action: 'cleanupPlayers',
        config: config.playerCleanup
      });
    }
  }

  // Get service status
  getStatus() {
    return {
      userSeen: {
        isRunning: this.isUserSeenRunning,
        enabled: config.userSeenCleanup.enabled,
        disableAfterMinutes: config.userSeenCleanup.disableAfterMinutes,
        intervalMinutes: config.userSeenCleanup.intervalMinutes,
        intervalId: this.userSeenIntervalId
      },
      player: {
        isRunning: this.isPlayerRunning,
        enabled: config.playerCleanup.enabled,
        disableAfterMinutes: config.playerCleanup.disableAfterMinutes,
        intervalMinutes: config.playerCleanup.intervalMinutes,
        intervalId: this.playerIntervalId
      }
    };
  }
}

// Create singleton instance
export const cleanupService = new CleanupService();