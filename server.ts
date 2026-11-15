import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { INITIAL_SERVICES, INITIAL_COMMISSION_SETTINGS } from './src/data/mockData';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Render terminates TLS at its proxy. Trust only the first proxy hop for client IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Firebase Phone Auth loads Google's reCAPTCHA frame and calls Identity Toolkit.
  // Helmet's default CSP blocks these cross-origin resources, preventing OTP verification.
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": [
        "'self'",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        "https://firestore.googleapis.com",
        "https://firebaseinstallations.googleapis.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://recaptchaenterprise.googleapis.com",
        "https://quickfix-india.firebaseapp.com",
      ],
      "frame-src": [
        "'self'",
        "https://www.google.com",
        "https://recaptcha.google.com",
        "https://www.recaptcha.net",
        "https://quickfix-india.firebaseapp.com",
      ],
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "https://www.google.com/recaptcha/",
        "https://www.gstatic.com/recaptcha/",
      ],
    },
  },
}));
app.use(express.json({ limit: '12mb' }));

let firebaseAdminApp: App | null = null;
try {
  if (getApps().length) {
    firebaseAdminApp = getApps()[0]!;
  } else {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    firebaseAdminApp = initializeApp(serviceAccountJson
      ? { credential: cert(JSON.parse(serviceAccountJson)) }
      : { credential: applicationDefault() });
  }
  console.info('Firebase Admin SDK initialized.');
} catch (error) {
  console.error('Firebase Admin SDK initialization failed; protected APIs will fail closed.', error);
}

type AuthenticatedRequest = Request & { firebaseUser?: import('firebase-admin/auth').DecodedIdToken };

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in one minute.' },
});

const authenticateFirebaseUser = async (req: Request, res: Response, next: NextFunction) => {
  if (!firebaseAdminApp) {
    return res.status(503).json({ success: false, error: 'Secure authentication is temporarily unavailable.' });
  }
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, error: 'A valid Firebase ID token is required.' });
  }
  try {
    (req as AuthenticatedRequest).firebaseUser = await getAuth(firebaseAdminApp).verifyIdToken(match[1], true);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Firebase ID token is invalid or expired.' });
  }
};

const requireServerAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as AuthenticatedRequest).firebaseUser?.admin) {
    return res.status(403).json({ success: false, error: 'Server-side admin permission required.' });
  }
  return next();
};

// Apply the API rate limit before registering any API route, including booking creation.
app.use('/api', apiRateLimit);

// Customer booking creation: server derives the service price and customer identity.
// No client-supplied role, price, OTP, assignment, payment or wallet value is trusted.
app.post('/api/bookings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { serviceId, scheduledDate, scheduledTimeSlot, address, notes, paymentMethod } = req.body ?? {};

    if (typeof serviceId !== 'string' || typeof scheduledDate !== 'string' ||
        typeof scheduledTimeSlot !== 'string' || typeof address !== 'string' ||
        !address.trim() || address.length > 500 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) ||
        !/^[\w\s:().,+-]{1,80}$/.test(scheduledTimeSlot) ||
        !['upi', 'cash'].includes(paymentMethod) ||
        (notes !== undefined && typeof notes !== 'string')) {
      return res.status(400).json({ success: false, error: 'Booking details are invalid. Please check service, date, time, address and payment method.' });
    }

    if (!firebaseAdminApp) {
      return res.status(503).json({ success: false, error: 'Secure booking is temporarily unavailable.' });
    }

    const db = getFirestore(firebaseAdminApp);
    const profileSnap = await db.collection('users').doc(identity.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== 'CUSTOMER') {
      return res.status(403).json({ success: false, error: 'A registered customer profile is required to book a service.' });
    }

    const profile = profileSnap.data()!;
    const service = INITIAL_SERVICES.find((item) => item.id === serviceId);
    if (!service) {
      return res.status(400).json({ success: false, error: 'Selected service is not available.' });
    }

    const price = service.startingPrice;
    const convenienceFee = INITIAL_COMMISSION_SETTINGS.platformConvenienceFee;
    const discount = 20;
    const subtotal = price + convenienceFee - discount;
    const taxes = Math.round(subtotal * INITIAL_COMMISSION_SETTINGS.gstPct / 100);
    const totalAmount = subtotal + taxes;
    const bookingRef = db.collection('bookings').doc();

    await bookingRef.create({
      id: bookingRef.id,
      customerUid: identity.uid,
      customerName: String(profile.displayName || '').slice(0, 100),
      customerPhone: identity.phone_number || String(profile.phoneNumber || '').slice(0, 30),
      customerAddress: address.trim(),
      serviceId: service.id,
      serviceTitle: service.title,
      category: service.category,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
      scheduledDate,
      scheduledTimeSlot,
      city: String(profile.city || '').slice(0, 100),
      pincode: String(profile.pincode || '').slice(0, 12),
      paymentMethod,
      status: 'requested',
      startOtp: '',
      price,
      convenienceFee,
      discount,
      taxes,
      totalAmount,
      paymentStatus: 'pending',
      escrowStatus: 'not_funded',
      createdAt: FieldValue.serverTimestamp()
    });

    return res.status(201).json({ success: true, bookingId: bookingRef.id });
  } catch (error) {
    console.error('Secure booking creation failed:', error);
    return res.status(500).json({ success: false, error: 'Booking could not be saved securely. Please retry.' });
  }
});


// Consent-based live location API. Coordinates are server-owned and never exposed
// through direct client Firestore access. Both booking participants must opt in.
const liveLocationStatuses = new Set(['assigned', 'technician_en_route']);
const validCoordinates = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
  typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;

async function getLiveLocationParticipant(bookingId: string, uid: string) {
  const db = getFirestore(firebaseAdminApp!);
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'BOOKING_NOT_FOUND' as const };
  const booking = snap.data()!;
  const role = booking.customerUid === uid ? 'customer'
    : (booking.technicianUid === uid || booking.assignedPartnerUid === uid) ? 'partner' : null;
  if (!role) return { error: 'NOT_A_BOOKING_PARTICIPANT' as const };
  if (!liveLocationStatuses.has(String(booking.status))) return { error: 'TRACKING_NOT_AVAILABLE_FOR_BOOKING_STATUS' as const };
  return { ref, booking, role };
}

app.post('/api/bookings/:bookingId/location/consent', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled must be true or false.' });
    const participant = await getLiveLocationParticipant(req.params.bookingId, uid);
    if ('error' in participant) return res.status(participant.error === 'BOOKING_NOT_FOUND' ? 404 : 403).json({ success: false, error: participant.error });
    await participant.ref.update({
      [`locationSharing.${participant.role}Enabled`]: enabled,
      [`locationSharing.${participant.role}UpdatedAt`]: FieldValue.serverTimestamp(),
    });
    if (!enabled) {
      await getFirestore(firebaseAdminApp!).collection('bookings').doc(req.params.bookingId)
        .collection('liveLocations').doc(uid).delete().catch(() => undefined);
    }
    return res.json({ success: true, enabled });
  } catch (error) {
    console.error('Live location consent update failed:', error);
    return res.status(500).json({ success: false, error: 'Could not update location sharing consent.' });
  }
});

app.post('/api/bookings/:bookingId/location', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const { lat, lng, accuracy } = req.body ?? {};
    if (!validCoordinates(lat, lng) ||
        (accuracy !== undefined && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000))) {
      return res.status(400).json({ success: false, error: 'GPS coordinates or accuracy are invalid.' });
    }
    const participant = await getLiveLocationParticipant(req.params.bookingId, uid);
    if ('error' in participant) return res.status(participant.error === 'BOOKING_NOT_FOUND' ? 404 : 403).json({ success: false, error: participant.error });
    const sharing = participant.booking.locationSharing || {};
    if (sharing.customerEnabled !== true || sharing.partnerEnabled !== true) {
      return res.status(403).json({ success: false, error: 'Both customer and Channel Partner must enable location sharing first.' });
    }
    const db = getFirestore(firebaseAdminApp!);
    await participant.ref.collection('liveLocations').doc(uid).set({
      uid, role: participant.role, lat, lng,
      ...(accuracy === undefined ? {} : { accuracy }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({ success: true, saved: true });
  } catch (error) {
    console.error('Live location update failed:', error);
    return res.status(500).json({ success: false, error: 'Could not update live location.' });
  }
});

app.get('/api/bookings/:bookingId/location', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const participant = await getLiveLocationParticipant(req.params.bookingId, uid);
    if ('error' in participant) return res.status(participant.error === 'BOOKING_NOT_FOUND' ? 404 : 403).json({ success: false, error: participant.error });
    const sharing = participant.booking.locationSharing || {};
    if (sharing.customerEnabled !== true || sharing.partnerEnabled !== true) {
      return res.status(403).json({ success: false, error: 'Location is visible only after both participants opt in.' });
    }
    const db = getFirestore(firebaseAdminApp!);
    const [customerSnap, partnerSnap] = await Promise.all([
      participant.ref.collection('liveLocations').doc(participant.booking.customerUid).get(),
      participant.ref.collection('liveLocations').doc(participant.booking.technicianUid || participant.booking.assignedPartnerUid).get(),
    ]);
    const now = Date.now();
    const serialize = (snap: FirebaseFirestore.DocumentSnapshot) => {
      if (!snap.exists) return null;
      const data = snap.data()!;
      const updatedAt = data.updatedAt?.toDate?.();
      return {
        role: data.role,
        lat: data.lat,
        lng: data.lng,
        updatedAt: updatedAt ? updatedAt.toISOString() : null,
        stale: !updatedAt || now - updatedAt.getTime() > 120000,
      };
    };
    return res.json({ success: true, customer: serialize(customerSnap), partner: serialize(partnerSnap) });
  } catch (error) {
    console.error('Live location read failed:', error);
    return res.status(500).json({ success: false, error: 'Could not read live locations.' });
  }
});

// API routes must verify Firebase identity; admin routes must additionally use requireServerAdmin.
app.use('/api/places', authenticateFirebaseUser);
app.use('/api/audio', authenticateFirebaseUser);
app.use('/api/music', authenticateFirebaseUser);

// Create Gemini client lazily so the web app can boot before an API key is configured.
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'quickfix-india' } },
  });
};

// 1. Maps Grounding API with gemini-3.8-flash & googleMaps tool
app.post('/api/places/grounding', async (req: Request, res: Response) => {
  try {
    const { query, city, lat, lng } = req.body;
    const prompt = query || `List the top real verified electrical hardware shops, plumbing spare parts dealers, AC refrigeration parts stores, and tool suppliers near ${city || 'Indore, Madhya Pradesh'}. Provide specific store names, known localities, what spare parts they stock, and practical advice for home repair technicians and customers.`;

    const requestConfig: any = {
      tools: [{ googleMaps: {} }],
    };

    if (lat && lng) {
      requestConfig.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: Number(lat),
            longitude: Number(lng),
          },
        },
      };
    }

    const response = await getAI().models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: requestConfig,
    });

    const text = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({
      success: true,
      text,
      groundingChunks,
    });
  } catch (error: any) {
    console.warn('Notice in /api/places/grounding (Google Maps disabled or quota limit):', error.message);
    const targetCity = req.body?.city || 'your selected city';
    res.status(503).json({
      success: false,
      text: `Live Google Maps lookup is currently unavailable for ${targetCity}. No shops or stock details could be verified. Please try again later or use a trusted local directory to confirm store names, addresses, opening hours, and availability.`,
      groundingChunks: [],
      isFallback: true,
      error: 'LIVE_PLACES_LOOKUP_UNAVAILABLE',
    });
  }
});

// 2. Audio Transcription API with gemini-3.5-transcribe
app.post('/api/audio/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ success: false, error: 'No audio data provided' });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType.split(';')[0], // normalize audio/webm;codecs=opus to audio/webm
        data: audioBase64,
      },
    };

    const response = await getAI().models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          {
            text: 'Transcribe this voice recording accurately. The speaker is describing a home repair or maintenance problem (such as electrician work, wiring, plumbing leakage, AC cooling issue, or refrigerator repair). Return only the transcription.',
          },
        ],
      },
    });

    res.json({
      success: true,
      transcription: response.text || '',
    });
  } catch (error: any) {
    console.error('Error in /api/audio/transcribe:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Audio transcription failed',
    });
  }
});

// 3. Service Jingle / Audio Generation with lyria-3-clip-preview
app.post('/api/music/generate', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const musicPrompt = prompt || 'Create a cheerful 15-second upbeat brand jingle for QuickFix home services with acoustic guitar and pleasant chimes.';

    const response = await getAI().models.generateContentStream({
      model: 'lyria-3-clip-preview',
      contents: musicPrompt,
    });

    const audioChunks: Buffer[] = [];
    let lyrics = '';
    let mimeType = 'audio/mpeg';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (audioChunks.length === 0 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          lyrics += part.text;
        }
      }
    }

    if (audioChunks.length === 0) {
      return res.status(500).json({ success: false, error: 'No audio stream returned from Lyria' });
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

    res.json({
      success: true,
      audioDataUrl,
      lyrics,
    });
  } catch (error: any) {
    console.error('Error in /api/music/generate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Music generation failed',
    });
  }
});

// 4. DISABLED: payout webhook must not claim verification without provider signature checks,
// event-id deduplication, and an atomic server-side ledger transaction.
// Keep this endpoint fail-closed until the verified Razorpay/Firebase Functions handler is deployed.
app.post('/api/webhooks/payout-confirmation', (_req: Request, res: Response) => {
  return res.status(503).json({
    success: false,
    verified: false,
    error: 'Payout webhook is not configured. No payout has been settled.'
  });
});

// Server-side admin gate. No client-supplied role or email is trusted.
app.get('/api/admin/health', authenticateFirebaseUser, requireServerAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, authenticated: true, authorization: 'server_verified_admin_claim' });
});

// Start Express and attach Vite middleware in dev or static in prod
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const isDev = process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';
  const isProd = process.env.NODE_ENV === 'production' || (!isDev && fs.existsSync(path.join(distPath, 'index.html')));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuickFix Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
