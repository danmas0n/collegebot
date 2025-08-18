const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'collegebot-dev'
  });
}

const db = admin.firestore();

async function migrateSubscriptionUsers() {
  console.log('Starting subscription user migration...');
  
  try {
    // Get all users from whitelisted_users collection that have subscription data
    const whitelistedUsersSnapshot = await db.collection('whitelisted_users').get();
    
    const subscriptionUsers = [];
    const whitelistOnlyUsers = [];
    
    // Separate subscription users from whitelist-only users
    whitelistedUsersSnapshot.forEach(doc => {
      const data = doc.data();
      const email = doc.id;
      
      // Check if this is a subscription user (has Stripe data or is marked as subscription)
      if (data.stripeCustomerId || data.subscriptionId || data.accessType === 'subscription' || data.isMainAccount) {
        subscriptionUsers.push({
          email,
          data
        });
      } else if (data.manuallyWhitelisted || data.accessType === 'manual' || (!data.accessType && !data.parentUserId)) {
        // This is a manually whitelisted user (not subscription, not family)
        whitelistOnlyUsers.push({
          email,
          data
        });
      }
      // Family members will be handled separately
    });
    
    console.log(`Found ${subscriptionUsers.length} subscription users to migrate`);
    console.log(`Found ${whitelistOnlyUsers.length} whitelist-only users to keep`);
    
    // Create subscription_users collection entries
    const batch = db.batch();
    let batchCount = 0;
    
    for (const user of subscriptionUsers) {
      const subscriptionUserRef = db.collection('subscription_users').doc(user.email);
      
      // Map old structure to new SubscriptionUser structure
      const subscriptionUserData = {
        email: user.email,
        userId: user.data.userId || '',
        stripeCustomerId: user.data.stripeCustomerId || '',
        subscriptionId: user.data.subscriptionId || '',
        subscriptionStatus: user.data.subscriptionStatus || 'active',
        isMainAccount: user.data.isMainAccount || true,
        trialUsed: user.data.trialUsed || true,
        familyMemberEmails: user.data.familyMemberEmails || [],
        parentAccountEmail: user.data.parentUserId ? null : undefined, // Will be set for family members
        accessSuspended: user.data.accessSuspended || false,
        suspendedAt: user.data.suspendedAt || null,
        suspendedBy: user.data.suspendedBy || null,
        restoredAt: user.data.restoredAt || null,
        restoredBy: user.data.restoredBy || null,
        gracePeriodStarted: user.data.gracePeriodStarted || null,
        createdAt: user.data.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // Remove undefined fields
      Object.keys(subscriptionUserData).forEach(key => {
        if (subscriptionUserData[key] === undefined) {
          delete subscriptionUserData[key];
        }
      });
      
      batch.set(subscriptionUserRef, subscriptionUserData);
      batchCount++;
      
      // Commit batch every 500 operations (Firestore limit)
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} subscription users`);
        batchCount = 0;
      }
    }
    
    // Commit remaining subscription users
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} subscription users`);
    }
    
    // Handle family members - they need to be moved to subscription_users too
    console.log('Processing family members...');
    const familyMemberBatch = db.batch();
    let familyBatchCount = 0;
    
    // Find family members (users with parentUserId)
    const familyMembersSnapshot = await db.collection('whitelisted_users')
      .where('parentUserId', '!=', null)
      .get();
    
    for (const doc of familyMembersSnapshot.docs) {
      const data = doc.data();
      const email = doc.id;
      
      // Find the parent's email to set parentAccountEmail
      let parentAccountEmail = null;
      for (const parentUser of subscriptionUsers) {
        if (parentUser.data.userId === data.parentUserId) {
          parentAccountEmail = parentUser.email;
          break;
        }
      }
      
      if (parentAccountEmail) {
        const familyMemberRef = db.collection('subscription_users').doc(email);
        
        // Get parent's subscription data
        const parentData = subscriptionUsers.find(u => u.email === parentAccountEmail)?.data;
        
        const familyMemberData = {
          email,
          userId: data.userId || '',
          stripeCustomerId: parentData?.stripeCustomerId || '',
          subscriptionId: parentData?.subscriptionId || '',
          subscriptionStatus: parentData?.subscriptionStatus || 'active',
          isMainAccount: false,
          trialUsed: true, // Family members can't use trial
          parentAccountEmail,
          accessSuspended: data.accessSuspended || false,
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        familyMemberBatch.set(familyMemberRef, familyMemberData);
        familyBatchCount++;
        
        if (familyBatchCount >= 500) {
          await familyMemberBatch.commit();
          console.log(`Committed batch of ${familyBatchCount} family members`);
          familyBatchCount = 0;
        }
      } else {
        console.warn(`Could not find parent for family member: ${email}`);
      }
    }
    
    if (familyBatchCount > 0) {
      await familyMemberBatch.commit();
      console.log(`Committed final batch of ${familyBatchCount} family members`);
    }
    
    // Clean up whitelisted_users collection - remove subscription users and family members
    console.log('Cleaning up whitelisted_users collection...');
    const cleanupBatch = db.batch();
    let cleanupBatchCount = 0;
    
    // Remove subscription users from whitelisted_users
    for (const user of subscriptionUsers) {
      const whitelistRef = db.collection('whitelisted_users').doc(user.email);
      cleanupBatch.delete(whitelistRef);
      cleanupBatchCount++;
      
      if (cleanupBatchCount >= 500) {
        await cleanupBatch.commit();
        console.log(`Cleaned up batch of ${cleanupBatchCount} users from whitelist`);
        cleanupBatchCount = 0;
      }
    }
    
    // Remove family members from whitelisted_users
    familyMembersSnapshot.forEach(doc => {
      const whitelistRef = db.collection('whitelisted_users').doc(doc.id);
      cleanupBatch.delete(whitelistRef);
      cleanupBatchCount++;
    });
    
    if (cleanupBatchCount > 0) {
      await cleanupBatch.commit();
      console.log(`Cleaned up final batch of ${cleanupBatchCount} users from whitelist`);
    }
    
    // Update remaining whitelisted users to use clean structure
    console.log('Updating remaining whitelisted users...');
    const updateBatch = db.batch();
    let updateBatchCount = 0;
    
    for (const user of whitelistOnlyUsers) {
      const whitelistRef = db.collection('whitelisted_users').doc(user.email);
      
      const cleanWhitelistData = {
        email: user.email,
        userId: user.data.userId || '',
        createdAt: user.data.createdAt || Timestamp.now(),
        createdBy: user.data.createdBy || 'system',
        reason: user.data.reason || 'Migrated from old system'
      };
      
      updateBatch.set(whitelistRef, cleanWhitelistData);
      updateBatchCount++;
      
      if (updateBatchCount >= 500) {
        await updateBatch.commit();
        console.log(`Updated batch of ${updateBatchCount} whitelist users`);
        updateBatchCount = 0;
      }
    }
    
    if (updateBatchCount > 0) {
      await updateBatch.commit();
      console.log(`Updated final batch of ${updateBatchCount} whitelist users`);
    }
    
    console.log('Migration completed successfully!');
    console.log(`- Migrated ${subscriptionUsers.length} subscription users to subscription_users collection`);
    console.log(`- Migrated ${familyMembersSnapshot.size} family members to subscription_users collection`);
    console.log(`- Kept ${whitelistOnlyUsers.length} users in whitelisted_users collection`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  migrateSubscriptionUsers()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateSubscriptionUsers };
