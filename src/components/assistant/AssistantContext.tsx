'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface AssistantModalContextType {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const AssistantModalContext = createContext<AssistantModalContextType>({
  isOpen: false,
  openAssistant: () => {},
  closeAssistant: () => {},
  toggleAssistant: () => {},
});

export function AssistantModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAssistant = () => setIsOpen(true);
  const closeAssistant = () => setIsOpen(false);
  const toggleAssistant = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AssistantModalContext.Provider
      value={{ isOpen, openAssistant, closeAssistant, toggleAssistant }}
    >
      {children}
    </AssistantModalContext.Provider>
  );
}

export function useAssistantModal() {
  return useContext(AssistantModalContext);
}
