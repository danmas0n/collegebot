import React, { createContext, useContext, useState, useCallback } from 'react';

interface ClaudeContextType {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  isConfigured: boolean;
}

const ClaudeContext = createContext<ClaudeContextType | undefined>(undefined);

// Try to load API key from localStorage
const getStoredApiKey = () => {
  try {
    return localStorage.getItem('claude_api_key');
  } catch (error) {
    console.error('Error reading API key from localStorage:', error);
    return null;
  }
};

export const ClaudeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(getStoredApiKey());

  const setApiKey = useCallback((key: string) => {
    try {
      localStorage.setItem('claude_api_key', key);
      setApiKeyState(key);
    } catch (error) {
      console.error('Error saving API key to localStorage:', error);
    }
  }, []);

  return (
    <ClaudeContext.Provider
      value={{
        apiKey,
        setApiKey,
        isConfigured: !!apiKey
      }}
    >
      {children}
    </ClaudeContext.Provider>
  );
};

export const useClaudeContext = () => {
  const context = useContext(ClaudeContext);
  if (context === undefined) {
    throw new Error('useClaudeContext must be used within a ClaudeProvider');
  }
  return context;
};
