import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export async function getSubscriptionState(managerId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  const permission = Notification.permission
  if (permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (!existing) return 'unsubscribed'
    // Verify it's stored in DB
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('manager_id', managerId)
      .eq('endpoint', existing.endpoint)
      .maybeSingle()
    return data ? 'subscribed' : 'unsubscribed'
  } catch {
    return 'unsubscribed'
  }
}

export async function subscribeToPush(managerId) {
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY not set')
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  const { endpoint, keys } = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    manager_id: managerId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function unsubscribeFromPush(managerId) {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete()
      .eq('manager_id', managerId).eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, c => c.charCodeAt(0))
}
