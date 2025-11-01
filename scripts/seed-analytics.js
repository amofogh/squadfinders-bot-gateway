import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { 
  recordCancel, 
  recordResume, 
  recordUserMessage, 
  recordReaction, 
  recordDmSent, 
  recordDmSkippedCanceled,
  recordPlayer 
} from '../src/services/analyticsService.js';

const TEST_USER_ID = 'tg:test123';

const seedAnalytics = async () => {
  try {
    console.log('🌱 Starting analytics seed...');
    
    // 1. Cancel user
    await recordCancel(TEST_USER_ID, {
      username: 'testuser',
      by: 'user',
      reason: 'User opted out'
    });
    console.log('✅ Recorded cancel');
    
    // 2. Resume user
    await recordResume(TEST_USER_ID, {
      username: 'testuser',
      by: 'user',
      reason: 'User opted back in'
    });
    console.log('✅ Recorded resume');
    
    // 3. Record multiple messages
    for (let i = 0; i < 5; i++) {
      await recordUserMessage(TEST_USER_ID, new Date(Date.now() - i * 60000));
    }
    console.log('✅ Recorded 5 messages');
    
    // 4. Record reactions
    await recordReaction(TEST_USER_ID, '👍');
    await recordReaction(TEST_USER_ID, '🔥');
    await recordReaction(TEST_USER_ID, '👍'); // Duplicate emoji
    console.log('✅ Recorded reactions');
    
    // 5. Record DMs
    await recordDmSent(TEST_USER_ID);
    await recordDmSent(TEST_USER_ID, new Date(Date.now() - 3600000)); // 1 hour ago
    await recordDmSkippedCanceled(TEST_USER_ID);
    console.log('✅ Recorded DM events');
    
    // 6. Record player event
    await recordPlayer(TEST_USER_ID);
    console.log('✅ Recorded player event');
    
    console.log('🎉 Analytics seed completed!');
    console.log(`📊 Test with: GET /api/stats/user/${TEST_USER_ID}`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
  }
};

const run = async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ MongoDB connected for seeding');
    
    await seedAnalytics();
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 MongoDB connection closed');
  }
};

run();