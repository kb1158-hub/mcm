// src/services/unifiedNotificationService.ts
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

interface Notification {
  id: string
  title: string
  message: string
  type: string
  priority: 'low' | 'medium' | 'high'
  is_read: boolean
  created_at: string
}

class UnifiedNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null
  private listeners: ((notification: Notification) => void)[] = []
  private notificationSound: HTMLAudioElement | null = null

  constructor() {
    this.initializeServiceWorker()
    this.initializeSupabaseRealtime()
    this.initializeNotificationSound()
  }

  private async initializeServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      console.log('Service Worker registered')
      
      // Listen for incoming push notifications
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NOTIFICATION_RECEIVED') {
          this.handleNotification(event.data.notification)
        }
      })
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  private initializeSupabaseRealtime() {
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          this.handleNotification(payload.new as Notification)
          this.showBrowserNotification(payload.new as Notification)
        }
      )
      .subscribe()
  }

  private initializeNotificationSound() {
    this.notificationSound = new Audio('/notification.mp3')
    this.notificationSound.load()
  }

  private async showBrowserNotification(notification: Notification) {
    if (!('Notification' in window)) return

    // Request permission if not granted
    if (Notification.permission !== 'granted') {
      await Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      const options = {
        body: notification.message,
        icon: '/icon-192x192.png',
        vibrate: [200, 100, 200],
        data: { id: notification.id }
      }

      // Prefer service worker notifications
      if (this.swRegistration) {
        this.swRegistration.showNotification(notification.title, options)
      } else {
        // Fallback to regular notifications
        const notif = new Notification(notification.title, options)
        notif.onclick = () => {
          window.focus()
          this.markAsRead(notification.id)
        }
      }

      // Play sound
      this.playNotificationSound(notification.priority)
    }
  }

  private playNotificationSound(priority: 'low' | 'medium' | 'high') {
    if (!this.notificationSound) return
    
    this.notificationSound.currentTime = 0
    this.notificationSound.volume = 
      priority === 'high' ? 0.5 : 
      priority === 'medium' ? 0.3 : 0.1
    this.notificationSound.play().catch(console.error)
  }

  private handleNotification(notification: Notification) {
    // Update UI
    this.listeners.forEach(listener => listener(notification))
    
    // Store in IndexedDB/local storage if needed
    this.storeNotification(notification)
  }

  private async storeNotification(notification: Notification) {
    // Implement your storage logic here
  }

  async markAsRead(notificationId: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  }

  addListener(callback: (notification: Notification) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }

  async requestNotificationPermission() {
    return Notification.requestPermission()
  }
}

export const notificationService = new UnifiedNotificationService()
