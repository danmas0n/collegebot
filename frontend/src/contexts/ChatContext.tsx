import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AiChat } from '../types/college';

interface ChatContextType {
  currentChat: AiChat | null;
  chats: AiChat[];
  loadChats: (studentId: string) => Promise<AiChat[]>;
  saveChat: (studentId: string, chat: AiChat) => Promise<void>;
  deleteChat: (studentId: string, chatId: string) => Promise<void>;
  setCurrentChat: (chat: AiChat | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentChat, setCurrentChat] = useState<AiChat | null>(null);
  const [chats, setChats] = useState<AiChat[]>([]);

  const loadChats = useCallback(async (studentId: string): Promise<AiChat[]> => {
    try {
      const response = await fetch('/api/chat/claude/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      });

      if (!response.ok) {
        throw new Error('Failed to load chats');
      }

      const { chats: loadedChats } = await response.json();
      setChats(loadedChats);
      setCurrentChat(null); // Reset current chat when loading new chats
      return loadedChats;
    } catch (error) {
      console.error('Error loading chats:', error);
      throw error;
    }
  }, []);

  const saveChat = useCallback(async (studentId: string, chat: AiChat) => {
    try {
      const response = await fetch('/api/chat/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, chat })
      });

      if (!response.ok) {
        throw new Error('Failed to save chat');
      }

      setChats(prev => {
        const index = prev.findIndex(c => c.id === chat.id);
        if (index >= 0) {
          return [...prev.slice(0, index), chat, ...prev.slice(index + 1)];
        }
        return [...prev, chat];
      });

      // Update current chat if this is the one being saved
      if (currentChat?.id === chat.id) {
        setCurrentChat(chat);
      }
    } catch (error) {
      console.error('Error saving chat:', error);
      throw error;
    }
  }, [currentChat]);

  const deleteChat = useCallback(async (studentId: string, chatId: string) => {
    try {
      const response = await fetch('/api/chat/claude/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, chatId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      setChats(prev => prev.filter(chat => chat.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }, [currentChat]);

  return (
    <ChatContext.Provider
      value={{
        currentChat,
        chats,
        loadChats,
        saveChat,
        deleteChat,
        setCurrentChat
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
