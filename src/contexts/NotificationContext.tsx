import { createContext, useContext, ReactNode } from 'react';
import { useNotifications } from '../components/Notification';

type NotificationContextType = ReturnType<typeof useNotifications>;

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications();

  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
