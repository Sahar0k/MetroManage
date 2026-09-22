import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationItemProps {
  notification: Notification;
  onClose: (id: string) => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  useEffect(() => {
    const duration = notification.duration || 5000;
    const timer = setTimeout(() => { onClose(notification.id); }, duration);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle size={20} className="text-emerald-400" />;
      case 'error': return <AlertCircle size={20} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={20} className="text-amber-400" />;
      case 'info': return <Info size={20} className="text-cyan-400" />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case 'success': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'error': return 'bg-red-500/10 border-red-500/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'info': return 'bg-cyan-500/10 border-cyan-500/30';
    }
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${getStyles()} shadow-lg`}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white">{notification.title}</p>
        {notification.message && <p className="text-sm text-slate-400 mt-1">{notification.message}</p>}
      </div>
      <button onClick={() => onClose(notification.id)} className="text-slate-400 hover:text-white transition-colors"><X size={16} /></button>
    </div>
  );
}

interface NotificationContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
}

export function NotificationContainer({ notifications, onClose }: NotificationContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[200] space-y-2 max-w-md">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onClose={onClose} />
      ))}
    </div>
  );
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { ...notification, id }]);
  };
  const removeNotification = (id: string) => { setNotifications((prev) => prev.filter((n) => n.id !== id)); };
  const success = (title: string, message?: string) => { addNotification({ type: 'success', title, message }); };
  const error = (title: string, message?: string) => { addNotification({ type: 'error', title, message }); };
  const warning = (title: string, message?: string) => { addNotification({ type: 'warning', title, message }); };
  const info = (title: string, message?: string) => { addNotification({ type: 'info', title, message }); };
  return { notifications, addNotification, removeNotification, success, error, warning, info };
}
