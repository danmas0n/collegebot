import { auth } from '../config/firebase';

export const getIdToken = async (forceRefresh = false): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken(forceRefresh);
};

export const getAuthHeaders = async (forceRefresh = false): Promise<HeadersInit> => {
  const token = await getIdToken(forceRefresh);
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};
