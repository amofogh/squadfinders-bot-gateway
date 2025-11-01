import mongoose from 'mongoose';

export const BUTTON_CATEGORIES = [
  'findplayer',
  'cancelplayer',
  'aboutus',
  'ourchannel'
];

const ButtonStatSchema = new mongoose.Schema({
  count: {
    type: Number,
    default: 0
  },
  last_at: {
    type: Date,
    default: null
  }
}, { _id: false });

const InteractionHistorySchema = new mongoose.Schema({
  button: {
    type: String,
    enum: BUTTON_CATEGORIES,
    required: true
  },
  at: {
    type: Date,
    required: true
  }
}, { _id: false });

const buttonTotalsSchemaDefinition = BUTTON_CATEGORIES.reduce((acc, button) => {
  acc[button] = {
    type: ButtonStatSchema,
    default: () => ({})
  };
  return acc;
}, {});

const BotUserStatSchema = new mongoose.Schema({
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
  full_name: {
    type: String,
    default: null
  },
  first_interaction_at: {
    type: Date,
    default: null
  },
  last_interaction_at: {
    type: Date,
    default: null
  },
  last_button: {
    type: String,
    enum: BUTTON_CATEGORIES,
    default: null
  },
  total_interactions: {
    type: Number,
    default: 0
  },
  button_totals: buttonTotalsSchemaDefinition,
  history: {
    type: [InteractionHistorySchema],
    default: []
  }
}, {
  timestamps: true
});

BotUserStatSchema.index({ last_interaction_at: -1 });

export const BotUserStat = mongoose.model('BotUserStat', BotUserStatSchema);

