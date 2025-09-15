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

    const intervalHours = config.userSeenCleanup.intervalHours;
    logCleanup('Starting UserSeen cleanup service', {
      intervalHours: intervalHours,
      disableAfterHours: config.userSeenCleanup.disableAfterHours
    });
    
    this.userSeenIntervalId = setInterval(async () => {
      await this.cleanupUserSeen();
    }, intervalHours * 60 * 60 * 1000);
    
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

    const intervalHours = config.playerCleanup.intervalHours;
    logCleanup('Starting Player cleanup service', {
      intervalHours: intervalHours,
      disableAfterHours: config.playerCleanup.disableAfterHours
    });
    
    this.playerIntervalId = setInterval(async () => {
      await this.cleanupPlayers();
    }, intervalHours * 60 * 60 * 1000);
    
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

  // Disable UserSeen records older than configured hours
  async cleanupUserSeen() {
    if (!config.userSeenCleanup.enabled) return;

    try {
      const cutoffTime = new Date(Date.now() - config.userSeenCleanup.disableAfterHours * 60 * 60 * 1000);
      
      logCleanup('Starting UserSeen cleanup', {
        cutoffTime: cutoffTime.toISOString(),
        disableAfterHours: config.userSeenCleanup.disableAfterHours
      });

      const result = await UserSeen.updateMany(
        {
          active: true,
          updatedAt: { $lt: cutoffTime }
        },
        {
          $set: { active: false }
        }
      );

      if (result.modifiedCount > 0) {
        logCleanup('UserSeen cleanup completed', {
          disabledCount: result.modifiedCount,
          disableAfterHours: config.userSeenCleanup.disableAfterHours,
          cutoffTime: cutoffTime.toISOString()
        });
      } else {
        logCleanup('UserSeen cleanup - no records to disable', {
          cutoffTime: cutoffTime.toISOString()
        });
      }
    } catch (error) {
      logError(error, {
        service: 'cleanup',
        action: 'cleanupUserSeen',
        config: config.userSeenCleanup
      });
    }
  }

  // Disable Players with message_date older than configured hours
  async cleanupPlayers() {
    if (!config.playerCleanup.enabled) return;

    try {
      const cutoffTime = new Date(Date.now() - config.playerCleanup.disableAfterHours * 60 * 60 * 1000);
      
      logCleanup('Starting Player cleanup', {
        cutoffTime: cutoffTime.toISOString(),
        disableAfterHours: config.playerCleanup.disableAfterHours
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
          disableAfterHours: config.playerCleanup.disableAfterHours,
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
        disableAfterHours: config.userSeenCleanup.disableAfterHours,
        intervalHours: config.userSeenCleanup.intervalHours,
        intervalId: this.userSeenIntervalId
      },
      player: {
        isRunning: this.isPlayerRunning,
        enabled: config.playerCleanup.enabled,
        disableAfterHours: config.playerCleanup.disableAfterHours,
        intervalHours: config.playerCleanup.intervalHours,
        intervalId: this.playerIntervalId
      }
    };
  }
}

// Create singleton instance
export const cleanupService = new CleanupService();