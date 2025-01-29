import { auth } from '../config/firebase';

export const getIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
};

export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}; 