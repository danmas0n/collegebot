import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  isWhitelisted: boolean;
  isAdmin: boolean;
  loading: boolean;
  subscriptionStatus: {
    hasAccess: boolean;
    accessType: 'admin' | 'manual' | 'subscription' | 'family' | 'none';
    subscriptionStatus?: string;
    trialDaysRemaining?: number;
    isMainAccount?: boolean;
    familyMemberCount?: number;
  } | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    hasAccess: boolean;
    accessType: 'admin' | 'manual' | 'subscription' | 'family' | 'none';
    subscriptionStatus?: string;
    trialDaysRemaining?: number;
    isMainAccount?: boolean;
    familyMemberCount?: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Check whitelist status
        const whitelistRef = doc(db, 'whitelisted_users', user.email || '');
        const whitelistDoc = await getDoc(whitelistRef);
        setIsWhitelisted(whitelistDoc.exists());

        // Check admin status
        const adminRef = doc(db, 'admin_users', user.email || '');
        const adminDoc = await getDoc(adminRef);
        setIsAdmin(adminDoc.exists());

        // Check subscription status
        await checkSubscriptionStatusInternal(user);
      } else {
        setIsWhitelisted(false);
        setIsAdmin(false);
        setSubscriptionStatus(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  const checkSubscriptionStatusInternal = async (user: User) => {
    if (!user?.email) {
      setSubscriptionStatus(null);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/status?email=${encodeURIComponent(user.email)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const status = await response.json();
        setSubscriptionStatus(status);
      } else {
        console.error('Failed to fetch subscription status');
        setSubscriptionStatus(null);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscriptionStatus(null);
    }
  };

  const checkSubscriptionStatus = useCallback(async () => {
    if (currentUser) {
      await checkSubscriptionStatusInternal(currentUser);
    }
  }, [currentUser?.uid]); // Only recreate when user ID changes

  const value = {
    currentUser,
    isWhitelisted,
    isAdmin,
    loading,
    subscriptionStatus,
    signInWithGoogle,
    logout,
    checkSubscriptionStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
