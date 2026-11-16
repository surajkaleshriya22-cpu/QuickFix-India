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
import { isValidBookingDate } from './src/utils/bookingDate';

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

// Secure Channel Partner registration. Only basic profile data is accepted here;
// government IDs, certificates, UPI details and deposits remain out of scope until
// a compliant restricted KYC workflow and verified payment provider are deployed.
app.post('/api/partners/register', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) {
      return res.status(503).json({ success: false, error: 'Secure registration is temporarily unavailable.' });
    }
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const verifiedPhone = identity.phone_number;
    const { displayName, email, trades, experienceYears, city, address } = req.body ?? {};
    const allowedTrades = new Set(['electrician', 'ac_fridge', 'plumber', 'welder', 'mechanic', 'driver', 'tourist_guide', 'contractor', 'bike_rider', 'labour']);

    if (!verifiedPhone || typeof displayName !== 'string' || displayName.trim().length < 2 ||
        displayName.trim().length > 100 ||
        typeof email !== 'string' || email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !Array.isArray(trades) || trades.length < 1 || trades.length > 9 ||
        new Set(trades).size !== trades.length ||
        trades.some((trade: unknown) => typeof trade !== 'string' || !allowedTrades.has(trade)) ||
        !Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60 ||
        typeof city !== 'string' || city.trim().length < 2 || city.trim().length > 100 ||
        (address !== undefined && (typeof address !== 'string' || address.trim().length > 500))) {
      return res.status(400).json({ success: false, error: 'Partner profile details are invalid.' });
    }

    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(userRef);
      if (existing.exists) {
        throw new Error('PROFILE_ALREADY_EXISTS');
      }
      transaction.create(userRef, {
        uid: identity.uid,
        phoneNumber: verifiedPhone,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role: 'CHANNEL_PARTNER',
        city: city.trim(),
        address: typeof address === 'string' ? address.trim() : '',
        trades: [...new Set(trades)],
        experienceYears,
        isVerified: false,
        approvalStatus: 'pending_audit',
        kycStatus: 'not_submitted',
        securityDepositPaid: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return res.status(201).json({
      success: true,
      approvalStatus: 'pending_audit',
      message: 'Basic partner profile created. KYC and approval are still pending; no deposit was collected.'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROFILE_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, error: 'An account already exists for this verified mobile number. Please use the correct sign-in option.' });
    }
    console.error('Secure partner registration failed:', error);
    return res.status(500).json({ success: false, error: 'Partner registration could not be saved securely. Please retry.' });
  }
});

// Customer booking creation: server derives the service price and customer identity.
// No client-supplied role, price, OTP, assignment, payment or wallet value is trusted.
app.post('/api/bookings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { serviceId, scheduledDate, scheduledTimeSlot, address, notes, paymentMethod } = req.body ?? {};

    if (typeof serviceId !== 'string' || typeof scheduledDate !== 'string' ||
        typeof scheduledTimeSlot !== 'string' || typeof address !== 'string' ||
        !address.trim() || address.length > 500 ||
        !isValidBookingDate(scheduledDate) ||
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
    const bookingCity = String(profile.city || '').trim();
    const normalizedCity = bookingCity.toLocaleLowerCase('en-IN');

    // Dispatch only to real, fully approved partners. Registration/basic profile
    // approval is not enough: KYC, online state, ₹2,000 reserve and wallet are
    // all server-checked. Missing fields deliberately make a profile ineligible.
    const partnerSnapshot = await db.collection('users')
      .where('role', '==', 'CHANNEL_PARTNER')
      .where('isOnline', '==', true)
      .limit(500)
      .get();
    const eligiblePartners = partnerSnapshot.docs.filter((partnerDoc) => {
      const partner = partnerDoc.data();
      const partnerTrades = Array.isArray(partner.trades) ? partner.trades : [];
      return String(partner.city || '').trim().toLocaleLowerCase('en-IN') === normalizedCity &&
        partner.isVerified === true &&
        partner.approvalStatus === 'approved' &&
        partner.kycStatus === 'approved' &&
        partner.securityDepositPaid === true &&
        Number.isFinite(partner.walletBalance) &&
        partner.walletBalance >= 2000 &&
        partner.isSuspended !== true &&
        partnerTrades.includes(service.category);
    }).slice(0, 50);

    const batch = db.batch();
    batch.create(bookingRef, {
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
      city: bookingCity.slice(0, 100),
      pincode: String(profile.pincode || '').slice(0, 12),
      paymentMethod,
      status: 'requested',
      dispatchStatus: eligiblePartners.length ? 'offered' : 'no_eligible_partner',
      offeredPartnerUids: eligiblePartners.map((partner) => partner.id),
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

    // Offers contain no customer phone, street address or private notes. Partners
    // receive only a service/city/time preview until a server accepts their offer.
    for (const partnerDoc of eligiblePartners) {
      const offerRef = db.collection('partner_booking_offers').doc(`${bookingRef.id}_${partnerDoc.id}`);
      batch.create(offerRef, {
        bookingId: bookingRef.id,
        partnerUid: partnerDoc.id,
        serviceId: service.id,
        serviceTitle: service.title,
        category: service.category,
        city: bookingCity.slice(0, 100),
        scheduledDate,
        scheduledTimeSlot,
        price,
        status: 'offered',
        createdAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();

    return res.status(201).json({
      success: true,
      bookingId: bookingRef.id,
      dispatchStatus: eligiblePartners.length ? 'offered' : 'no_eligible_partner',
      eligiblePartnerCount: eligiblePartners.length
    });
  } catch (error) {
    console.error('Secure booking creation failed:', error);
    return res.status(500).json({ success: false, error: 'Booking could not be saved securely. Please retry.' });
  }
});

// Return only the authenticated partner's sanitized booking offers.
app.get('/api/partners/offers', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure dispatch is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const db = getFirestore(firebaseAdminApp);
    const partnerSnap = await db.collection('users').doc(identity.uid).get();
    if (!partnerSnap.exists) return res.status(403).json({ success: false, error: 'Channel Partner profile is required.' });
    const partner = partnerSnap.data()!;
    const eligible = partner.role === 'CHANNEL_PARTNER' &&
      partner.isVerified === true &&
      partner.approvalStatus === 'approved' &&
      partner.kycStatus === 'approved' &&
      partner.securityDepositPaid === true &&
      Number.isFinite(partner.walletBalance) && partner.walletBalance >= 2000 &&
      partner.isOnline === true && partner.isSuspended !== true;
    if (!eligible) return res.status(403).json({ success: false, error: 'Partner is not currently eligible for booking offers.' });

    const offersSnap = await db.collection('partner_booking_offers')
      .where('partnerUid', '==', identity.uid)
      .where('status', '==', 'offered')
      .limit(50)
      .get();
    const offers = [];
    for (const offerDoc of offersSnap.docs) {
      const offer = offerDoc.data();
      const bookingSnap = await db.collection('bookings').doc(String(offer.bookingId || '')).get();
      if (!bookingSnap.exists) continue;
      const booking = bookingSnap.data()!;
      if (booking.status !== 'requested' || booking.technicianUid ||
          String(booking.city || '').trim().toLocaleLowerCase('en-IN') !== String(partner.city || '').trim().toLocaleLowerCase('en-IN') ||
          !Array.isArray(partner.trades) || !partner.trades.includes(booking.category)) continue;
      offers.push({
        offerId: offerDoc.id,
        bookingId: offer.bookingId,
        serviceId: offer.serviceId,
        serviceTitle: offer.serviceTitle,
        category: offer.category,
        city: offer.city,
        scheduledDate: offer.scheduledDate,
        scheduledTimeSlot: offer.scheduledTimeSlot,
        price: offer.price,
        status: offer.status
      });
    }
    return res.json({ success: true, offers });
  } catch (error) {
    console.error('Partner offer lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Booking offers could not be loaded.' });
  }
});

// Accept an offer atomically. Eligibility is rechecked at acceptance time so an
// offline, suspended, unverified or under-reserve partner cannot claim a job.
app.post('/api/bookings/:bookingId/accept', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure dispatch is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = String(req.params.bookingId || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(bookingId)) {
      return res.status(400).json({ success: false, error: 'Booking ID is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(identity.uid);
    const bookingRef = db.collection('bookings').doc(bookingId);
    const offerRef = db.collection('partner_booking_offers').doc(`${bookingId}_${identity.uid}`);
    await db.runTransaction(async (transaction) => {
      const [partnerSnap, bookingSnap, offerSnap] = await Promise.all([
        transaction.get(partnerRef), transaction.get(bookingRef), transaction.get(offerRef)
      ]);
      if (!partnerSnap.exists || !bookingSnap.exists || !offerSnap.exists) throw new Error('OFFER_NOT_FOUND');
      const partner = partnerSnap.data()!;
      const booking = bookingSnap.data()!;
      const eligible = partner.role === 'CHANNEL_PARTNER' &&
        partner.isVerified === true && partner.approvalStatus === 'approved' &&
        partner.kycStatus === 'approved' && partner.securityDepositPaid === true &&
        Number.isFinite(partner.walletBalance) && partner.walletBalance >= 2000 &&
        partner.isOnline === true && partner.isSuspended !== true &&
        String(partner.city || '').trim().toLocaleLowerCase('en-IN') === String(booking.city || '').trim().toLocaleLowerCase('en-IN') &&
        Array.isArray(partner.trades) && partner.trades.includes(booking.category);
      if (!eligible) throw new Error('PARTNER_NOT_ELIGIBLE');
      if (booking.status !== 'requested' || booking.technicianUid) throw new Error('BOOKING_ALREADY_CLAIMED');
      transaction.update(bookingRef, {
        technicianUid: identity.uid,
        technicianName: String(partner.displayName || '').slice(0, 100),
        status: 'assigned',
        dispatchStatus: 'accepted',
        assignedAt: FieldValue.serverTimestamp(),
        acceptedAt: FieldValue.serverTimestamp()
      });
      transaction.delete(offerRef);
    });
    const otherOffers = await db.collection('partner_booking_offers').where('bookingId', '==', bookingId).get();
    const cleanup = db.batch();
    otherOffers.docs.forEach((doc) => cleanup.delete(doc.ref));
    if (!otherOffers.empty) await cleanup.commit();
    return res.json({ success: true, bookingId, status: 'assigned' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'OFFER_NOT_FOUND') return res.status(404).json({ success: false, error: 'This booking offer is no longer available.' });
    if (code === 'PARTNER_NOT_ELIGIBLE') return res.status(403).json({ success: false, error: 'Partner eligibility requirements are not met.' });
    if (code === 'BOOKING_ALREADY_CLAIMED') return res.status(409).json({ success: false, error: 'This booking has already been accepted or is no longer available.' });
    console.error('Partner booking acceptance failed:', error);
    return res.status(500).json({ success: false, error: 'Booking could not be accepted securely.' });
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

// Admin-only Channel Partner review API. This approves the basic profile for the next
// KYC stage only; it never marks a partner verified or enables job acceptance.
app.get('/api/admin/partners/pending', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('users')
      .where('role', '==', 'CHANNEL_PARTNER')
      .where('approvalStatus', '==', 'pending_audit')
      .limit(100)
      .get();
    const partners = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: String(data.displayName || ''),
        email: String(data.email || ''),
        phoneNumber: String(data.phoneNumber || ''),
        city: String(data.city || ''),
        trades: Array.isArray(data.trades) ? data.trades : [],
        experienceYears: Number(data.experienceYears || 0),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        approvalStatus: data.approvalStatus,
        kycStatus: data.kycStatus || 'not_submitted'
      };
    });
    return res.json({ success: true, partners });
  } catch (error) {
    console.error('Admin pending partner lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Pending partner list could not be loaded.' });
  }
});

app.post('/api/admin/partners/:partnerUid/review', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const partnerUid = String(req.params.partnerUid || '');
    const { decision, reason } = req.body ?? {};
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(partnerUid) ||
        !['approve_profile', 'reject'].includes(decision) ||
        (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 500))) {
      return res.status(400).json({ success: false, error: 'Partner review details are invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(partnerUid);
    const auditRef = db.collection('admin_audit_logs').doc();
    let resultingStatus = '';
    await db.runTransaction(async (transaction) => {
      const partnerSnap = await transaction.get(partnerRef);
      if (!partnerSnap.exists) throw new Error('PARTNER_NOT_FOUND');
      const partner = partnerSnap.data()!;
      if (partner.role !== 'CHANNEL_PARTNER') throw new Error('NOT_A_PARTNER');
      if (partner.approvalStatus !== 'pending_audit') throw new Error('PARTNER_NOT_PENDING');
      resultingStatus = decision === 'approve_profile' ? 'basic_profile_approved' : 'rejected';
      transaction.update(partnerRef, {
        approvalStatus: resultingStatus,
        profileReviewReason: typeof reason === 'string' ? reason.trim() : '',
        profileReviewedBy: identity.uid,
        profileReviewedAt: FieldValue.serverTimestamp(),
        // Approval of basic profile is NOT qualification/KYC approval.
        isVerified: false,
        kycStatus: partner.kycStatus || 'not_submitted',
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(auditRef, {
        action: decision,
        targetUid: partnerUid,
        actorUid: identity.uid,
        reason: typeof reason === 'string' ? reason.trim() : '',
        createdAt: FieldValue.serverTimestamp()
      });
    });
    return res.json({
      success: true,
      approvalStatus: resultingStatus,
      isVerified: false,
      message: decision === 'approve_profile'
        ? 'Basic profile approved for the next KYC stage. Partner is not verified and cannot accept jobs.'
        : 'Partner profile rejected.'
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PARTNER_NOT_FOUND') return res.status(404).json({ success: false, error: 'Partner profile was not found.' });
    if (code === 'NOT_A_PARTNER') return res.status(400).json({ success: false, error: 'The selected account is not a Channel Partner.' });
    if (code === 'PARTNER_NOT_PENDING') return res.status(409).json({ success: false, error: 'This partner profile is no longer pending review.' });
    console.error('Admin partner review failed:', error);
    return res.status(500).json({ success: false, error: 'Partner review could not be saved securely.' });
  }
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
