import admin from 'firebase-admin';

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;

    // Update whitelisted_users document with userId if it's missing
    await updateWhitelistedUserOnLogin(decodedToken);

    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to update whitelisted_users document with userId on first login
const updateWhitelistedUserOnLogin = async (decodedToken) => {
  try {
    const { uid, email } = decodedToken;
    if (!email) return; // Skip if no email

    const whitelistedUserRef = admin.firestore().collection('whitelisted_users').doc(email);
    const whitelistedUserDoc = await whitelistedUserRef.get();

    if (whitelistedUserDoc.exists) {
      const userData = whitelistedUserDoc.data();
      
      // If userId is missing or doesn't match current UID, update it
      if (!userData.userId || userData.userId !== uid) {
        console.log(`Updating userId for whitelisted user: ${email} (${uid})`);
        await whitelistedUserRef.update({
          userId: uid,
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Successfully updated userId for ${email}`);
      }
    }
  } catch (error) {
    // Don't fail authentication if this update fails, just log it
    if (error.code === 'auth/insufficient-permission' || error.message.includes('serviceusage.serviceUsageConsumer')) {
      console.log(`Note: Cannot update userId for ${decodedToken.email} due to missing IAM permissions. Please grant 'Service Usage Consumer' role to your service account.`);
    } else {
      console.error('Error updating whitelisted user on login:', error.message);
    }
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { admin: isAdmin } = req.user;
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
