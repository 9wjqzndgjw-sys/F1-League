import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Minimal VAPID / Web Push implementation ────────────────────────────────

function b64urlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

function uint8ToB64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function makeVapidJwt(audience: string, subject: string, privateKeyB64url: string): Promise<string> {
  const header = uint8ToB64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = uint8ToB64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })))
  const signingInput = `${header}.${payload}`

  const keyBytes = b64urlToUint8(privateKeyB64url)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    // Wrap raw scalar into PKCS#8 DER for P-256
    buildPkcs8(keyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${uint8ToB64url(new Uint8Array(sig))}`
}

// Build a minimal PKCS#8 DER wrapping a raw 32-byte P-256 private key scalar.
function buildPkcs8(rawPriv: Uint8Array): ArrayBuffer {
  // SEC 1 ECPrivateKey for P-256 (OID 1.2.840.10045.3.1.7)
  const ecOid    = Uint8Array.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07])
  const algOid   = Uint8Array.from([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01])
  const privVal  = Uint8Array.from([0x04, 0x01, ...rawPriv]) // version=1 + private key
  const ecPriv   = tlv(0x30, concat(tlv(0x02, Uint8Array.from([0x01])), tlv(0x04, rawPriv)))
  const algSeq   = tlv(0x30, concat(algOid, ecOid))
  const inner    = tlv(0x04, ecPriv)
  return tlv(0x30, concat(tlv(0x02, Uint8Array.from([0x00])), algSeq, inner)).buffer
}

function tlv(tag: number, value: Uint8Array): Uint8Array {
  const len = value.length
  let lenBytes: Uint8Array
  if (len < 128) {
    lenBytes = Uint8Array.from([len])
  } else if (len < 256) {
    lenBytes = Uint8Array.from([0x81, len])
  } else {
    lenBytes = Uint8Array.from([0x82, len >> 8, len & 0xff])
  }
  return concat(Uint8Array.from([tag]), lenBytes, value)
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder()
  const plaintext = encoder.encode(payload)

  // Import recipient public key (uncompressed P-256 point)
  const recipientPublicKey = await crypto.subtle.importKey(
    'raw',
    b64urlToUint8(p256dhB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPublicKey }, serverKeyPair.privateKey, 256),
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const authSecret = b64urlToUint8(authB64)

  // HKDF for content encryption key and nonce (RFC 8291)
  const prk = await hkdf(authSecret, sharedSecret, buildInfo('auth', new Uint8Array(0), new Uint8Array(0)), 32)
  const recipientPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', recipientPublicKey))
  const keyingMaterial = await hkdf(salt, prk, buildInfo('aesgcm', recipientPubRaw, serverPublicKeyRaw), 32)
  const nonceMaterial  = await hkdf(salt, prk, buildInfo('nonce', recipientPubRaw, serverPublicKeyRaw), 12)

  const aesKey = await crypto.subtle.importKey('raw', keyingMaterial, { name: 'AES-GCM' }, false, ['encrypt'])

  // Pad to 4096 bytes (RFC 8291 §4)
  const padLength = 4096 - 2 - plaintext.length
  const padded = new Uint8Array(2 + plaintext.length + Math.max(0, padLength))
  new DataView(padded.buffer).setUint16(0, Math.max(0, padLength), false)
  padded.set(plaintext, 2 + Math.max(0, padLength))

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceMaterial }, aesKey, padded),
  )

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw }
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    length * 8,
  )
  return new Uint8Array(bits)
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder()
  const prefix = encoder.encode(`Content-Encoding: ${type}\0`)
  if (type === 'auth') {
    return prefix
  }
  // "P-256" label
  const label = encoder.encode('P-256\0')
  const clientLen = new Uint8Array(2); new DataView(clientLen.buffer).setUint16(0, clientKey.length, false)
  const serverLen = new Uint8Array(2); new DataView(serverLen.buffer).setUint16(0, serverKey.length, false)
  return concat(prefix, label, clientLen, clientKey, serverLen, serverKey)
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`

  const jwt = await makeVapidJwt(audience, vapidSubject, vapidPrivateKey)

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(payload, subscription.p256dh, subscription.auth)

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      Encryption: `salt=${uint8ToB64url(salt)}`,
      'Crypto-Key': `dh=${uint8ToB64url(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      Authorization: `WebPush ${jwt}`,
      TTL: '86400',
    },
    body: ciphertext,
  })
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@f1fantasy.app'

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { pick } = await req.json()
    if (!pick) throw new Error('Missing pick')

    // Look up what was picked
    let pickLabel = 'something'
    if (pick.driver_id) {
      const { data } = await supabaseAdmin.from('drivers').select('name').eq('id', pick.driver_id).single()
      if (data) pickLabel = data.name
    } else if (pick.constructor_id) {
      const { data } = await supabaseAdmin.from('constructors').select('name').eq('id', pick.constructor_id).single()
      if (data) pickLabel = data.name
    }

    const { data: manager } = await supabaseAdmin
      .from('managers').select('display_name').eq('id', pick.manager_id).single()
    const managerName = manager?.display_name ?? 'Someone'

    const payload = JSON.stringify({
      title: 'F1 Fantasy — Pick Made',
      body: `${managerName} picked ${pickLabel}`,
    })

    // Send to all subscriptions except the picker's own
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .neq('manager_id', pick.manager_id)

    const results = await Promise.allSettled(
      (subs ?? []).map(sub =>
        sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, vapidPublic, vapidPrivate, vapidSubject)
      )
    )

    // Remove expired subscriptions (410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.status === 410) {
        expiredEndpoints.push((subs ?? [])[i].endpoint)
      }
    })
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    return new Response(JSON.stringify({ sent: subs?.length ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
