import mongoose from 'mongoose';

const UserStatsSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    username: {
        type: String,
        default: null
    },
    button_clicks: {
        find_player: {
            count: {
                type: Number,
                default: 0
            },
            last_clicked_at: {
                type: Date,
                default: null
            }
        },
        dont_want_to_play: {
            count: {
                type: Number,
                default: 0
            },
            last_clicked_at: {
                type: Date,
                default: null
            }
        },
        about_us: {
            count: {
                type: Number,
                default: 0
            },
            last_clicked_at: {
                type: Date,
                default: null
            }
        },
        channel_and_group: {
            count: {
                type: Number,
                default: 0
            },
            last_clicked_at: {
                type: Date,
                default: null
            }
        }
    },
    total_clicks: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for better query performance
UserStatsSchema.index({ 'button_clicks.find_player.count': 1 });
UserStatsSchema.index({ 'button_clicks.dont_want_to_play.count': 1 });
UserStatsSchema.index({ 'button_clicks.about_us.count': 1 });
UserStatsSchema.index({ 'button_clicks.channel_and_group.count': 1 });
UserStatsSchema.index({ total_clicks: 1 });

export const UserStats = mongoose.model('UserStats', UserStatsSchema);

