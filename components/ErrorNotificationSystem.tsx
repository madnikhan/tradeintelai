'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'

export interface ErrorNotification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  timestamp: Date
  context?: string
  dismissible?: boolean
  autoDismiss?: number // milliseconds
}

interface ErrorNotificationSystemProps {
  children?: React.ReactNode
}

export function ErrorNotificationSystem({ children }: ErrorNotificationSystemProps) {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([])

  useEffect(() => {
    // Listen for error events from logger
    const handleLogError = (event: CustomEvent) => {
      const { message, data, context } = event.detail
      addNotification({
        type: 'error',
        title: 'System Error',
        message: message,
        context: context,
      })
    }

    // 🔒 DISABLED: Warning notifications removed per user request
    // const handleLogWarning = (event: CustomEvent) => {
    //   const { message, data, context } = event.detail
    //   addNotification({
    //     type: 'warning',
    //     title: 'Warning',
    //     message: message,
    //     context: context,
    //   })
    // }

    window.addEventListener('log-error', handleLogError as EventListener)
    // 🔒 DISABLED: Warning notifications removed per user request
    // window.addEventListener('log-warning', handleLogWarning as EventListener)

    return () => {
      window.removeEventListener('log-error', handleLogError as EventListener)
      // 🔒 DISABLED: Warning notifications removed per user request
      // window.removeEventListener('log-warning', handleLogWarning as EventListener)
    }
  }, [])

  const addNotification = useCallback((notification: Omit<ErrorNotification, 'id' | 'timestamp'>) => {
    const newNotification: ErrorNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      dismissible: notification.dismissible !== false,
      autoDismiss: notification.autoDismiss || (notification.type === 'info' ? 5000 : undefined),
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto-dismiss if configured
    if (newNotification.autoDismiss) {
      setTimeout(() => {
        removeNotification(newNotification.id)
      }, newNotification.autoDismiss)
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // Expose addNotification globally for use in other components
  useEffect(() => {
    (window as any).addErrorNotification = addNotification
    return () => {
      delete (window as any).addErrorNotification
    }
  }, [addNotification])

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'info':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400'
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-400'
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400'
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      case 'success':
        return '✅'
      default:
        return '📢'
    }
  }

  return (
    <>
      {children}
      
      {/* Notification Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
        {notifications
          .filter(notification => notification.type !== 'warning') // 🔒 FILTER: Hide warning notifications
          .map(notification => (
          <div
            key={notification.id}
            className={`${getNotificationColor(notification.type)} border rounded-lg p-4 shadow-lg backdrop-blur-sm animate-slide-in-right`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getNotificationIcon(notification.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm mb-1">{notification.title}</div>
                <div className="text-xs opacity-90">{notification.message}</div>
                {notification.context && (
                  <div className="text-xs opacity-70 mt-1 font-mono">{notification.context}</div>
                )}
                <div className="text-xs opacity-60 mt-1">
                  {notification.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {notification.dismissible && (
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

// Helper function to add notifications from anywhere
export function notifyError(title: string, message: string, context?: string) {
  if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
    (window as any).addErrorNotification({
      type: 'error',
      title,
      message,
      context,
    })
  }
}

export function notifyWarning(title: string, message: string, context?: string) {
  // 🔒 DISABLED: Warning notifications removed per user request
  // Warnings are no longer displayed on the dashboard
  // if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
  //   (window as any).addErrorNotification({
  //     type: 'warning',
  //     title,
  //     message,
  //     context,
  //   })
  // }
}

export function notifyInfo(title: string, message: string, context?: string) {
  if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
    (window as any).addErrorNotification({
      type: 'info',
      title,
      message,
      context,
    })
  }
}

export function notifySuccess(title: string, message: string, context?: string) {
  if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
    (window as any).addErrorNotification({
      type: 'success',
      title,
      message,
      context,
    })
  }
}

