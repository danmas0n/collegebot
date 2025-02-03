import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AiChat } from '../types/college';
import { api } from '../utils/api';

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
      const response = await api.post('/api/chat/chats', { studentId });
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
      await api.post('/api/chat/chat', { studentId, chat });

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
      await api.delete(`/api/chat/chat/${chatId}`, { body: JSON.stringify({ studentId }) });

      setChats(prev => prev.filter(c => c.id !== chatId));
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
