import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, FieldPath, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { INITIAL_SERVICES, INITIAL_COMMISSION_SETTINGS } from './src/data/mockData';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { randomInt, randomUUID, timingSafeEqual, createCipheriv, randomBytes, createHmac } from 'node:crypto';
import { fileURLToPath } from 'url';
import { isValidBookingDate } from './src/utils/bookingDate';
import { canPartnerReceiveBookingCategory, isPartnerEligibleForDispatch } from './src/utils/partnerEligibility';
import { calculateRateQuote, resolveLocationRateCard, type LocationRateCard } from './src/data/rateCards';
import { getBillingProfile, type BillingUnit } from './src/data/pricing';
import { isWithinPartnerDispatchRadius } from './src/utils/geo';
import { isStartOtpBookingStatus, isStartOtpExpired, isValidStartOtp } from './src/utils/bookingOtp';

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
app.use(express.json({ limit: '12mb', verify: (req, _res, buffer) => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));

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


// Customer rate quote lookup. Prices are resolved only from approved, effective
// Firestore rate cards; the client cannot submit or override a price.
app.get('/api/rates/quote', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) {
      return res.status(503).json({ success: false, error: 'Secure rate lookup is temporarily unavailable.' });
    }
    const params = req.query;
    const read = (key: string) => typeof params[key] === 'string' ? String(params[key]).trim() : '';
    const state = read('state');
    const district = read('district');
    const city = read('city');
    const tehsil = read('tehsil');
    const serviceCategory = read('serviceCategory');
    const serviceId = read('serviceId');
    const unit = read('unit') as BillingUnit;
    const date = read('date');
    const quantity = Number(read('quantity'));
    const validUnits: BillingUnit[] = ['per_visit', 'per_point', 'per_piece', 'per_hour', 'per_day', 'per_sqft', 'per_kg', 'per_km', 'per_trip', 'per_job', 'quote'];
    if (!state || state.length > 100 || !district || district.length > 100 ||
        city.length > 100 || tehsil.length > 100 ||
        !serviceCategory || serviceCategory.length > 80 ||
        serviceId.length > 120 || !validUnits.includes(unit) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      return res.status(400).json({ success: false, error: 'Rate quote inputs are invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const snapshot = await db.collection('rate_cards')
      .where('approvalStatus', '==', 'approved')
      .limit(200)
      .get();
    const cards = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() } as LocationRateCard))
      .filter(card => card.state.trim().toLocaleLowerCase('en-IN') === state.toLocaleLowerCase('en-IN')
        && card.district.trim().toLocaleLowerCase('en-IN') === district.toLocaleLowerCase('en-IN')
        && card.serviceCategory === serviceCategory
        && card.unit === unit);
    const card = resolveLocationRateCard(cards, { state, district, city, tehsil }, serviceCategory, serviceId, unit, date);
    if (!card) {
      return res.status(404).json({ success: false, error: 'No approved rate card is available for this service and location.', quoteAvailable: false });
    }
    const quote = calculateRateQuote(card, quantity);
    return res.json({
      success: true,
      quoteAvailable: true,
      currency: 'INR',
      location: { state: card.state, district: card.district, city: card.city || null, tehsil: card.tehsil || null },
      serviceCategory: card.serviceCategory,
      serviceId: card.serviceId || null,
      source: { name: card.sourceName, checkedAt: card.sourceCheckedAt },
      approvalStatus: card.approvalStatus,
      effectiveFrom: card.effectiveFrom,
      effectiveTo: card.effectiveTo || null,
      quote
    });
  } catch (error) {
    console.error('Secure location rate quote failed:', error);
    return res.status(500).json({ success: false, error: 'A secure rate quote could not be calculated.' });
  }
});

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
    const { displayName, email, trades, experienceYears, city, address, serviceArea } = req.body ?? {};
    const validServiceArea = serviceArea === undefined || (
      serviceArea !== null && typeof serviceArea === 'object' && !Array.isArray(serviceArea) &&
      ['state', 'district', 'tehsil'].every((key) =>
        typeof serviceArea[key] === 'string' &&
        serviceArea[key].trim().length > 0 &&
        serviceArea[key].trim().length <= 100
      ) &&
      ['stateCode', 'districtCode', 'tehsilCode'].every((key) =>
        serviceArea[key] === undefined ||
        (typeof serviceArea[key] === 'string' && serviceArea[key].trim().length > 0 && serviceArea[key].trim().length <= 30)
      ) &&
      (['stateCode', 'districtCode', 'tehsilCode'].every((key) => typeof serviceArea[key] === 'string') ||
       ['stateCode', 'districtCode', 'tehsilCode'].every((key) => serviceArea[key] === undefined))
    );
    const allowedTrades = new Set(['electrician', 'plumber', 'technician', 'ac_repair', 'fridge_repair', 'ac_fridge', 'welder', 'mechanic', 'driver', 'tourist_guide', 'contractor', 'bike_taxi', 'bike_rider', 'kaamkaaj_partner', 'house_cleaning', 'cook', 'laundry', 'maid', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting', 'labour']);

    if (!verifiedPhone || typeof displayName !== 'string' || displayName.trim().length < 2 ||
        displayName.trim().length > 100 ||
        typeof email !== 'string' || email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !Array.isArray(trades) || trades.length < 1 || trades.length > 22 ||
        new Set(trades).size !== trades.length ||
        trades.some((trade: unknown) => typeof trade !== 'string' || !allowedTrades.has(trade)) ||
        !Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60 ||
        typeof city !== 'string' || city.trim().length < 2 || city.trim().length > 100 ||
        !validServiceArea ||
        (address !== undefined && (typeof address !== 'string' || address.trim().length > 500))) {
      return res.status(400).json({ success: false, error: 'Partner profile details are invalid.' });
    }

    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    const rechargeSettings = await db.collection('settings').doc('partner_recharge').get();
    const trialDays = Number.isInteger(rechargeSettings.data()?.trialDays) ? Number(rechargeSettings.data()?.trialDays) : 30;
    const trialExpiry = new Date(Date.now() + trialDays * 86400000);
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
        subscriptionStatus: trialDays > 0 ? 'trial' : 'expired',
        subscriptionTrialDaysGranted: trialDays,
        subscriptionTrialStartedAt: FieldValue.serverTimestamp(),
        subscriptionExpiresAt: trialExpiry,
        city: city.trim(),
        address: typeof address === 'string' ? address.trim() : '',
        ...(validServiceArea && serviceArea ? {
          serviceArea: {
            state: serviceArea.state.trim(),
            district: serviceArea.district.trim(),
            tehsil: serviceArea.tehsil.trim(),
            ...(serviceArea.stateCode ? { stateCode: serviceArea.stateCode.trim() } : {}),
            ...(serviceArea.districtCode ? { districtCode: serviceArea.districtCode.trim() } : {}),
            ...(serviceArea.tehsilCode ? { tehsilCode: serviceArea.tehsilCode.trim() } : {})
          }
        } : {}),
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

// Partner-owned UPI payment profile. This only publishes a verified-format VPA for QR display;
// it does not confirm payments or change booking payment status.
app.get('/api/partners/payment-profile', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner payment profile is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const ref = getFirestore(firebaseAdminApp).collection('users').doc(identity.uid);
    const snap = await ref.get();
    if (!snap.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(snap.data()?.role || ''))) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    const profile = snap.data()!;
    return res.json({ success: true, upiId: typeof profile.paymentUpiId === 'string' ? profile.paymentUpiId : '', payeeName: String(profile.displayName || '').slice(0, 80) });
  } catch (error) {
    console.error('Partner payment profile read failed:', error);
    return res.status(500).json({ success: false, error: 'Payment profile could not be loaded.' });
  }
});

app.put('/api/partners/payment-profile', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner payment profile is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const upiId = typeof req.body?.upiId === 'string' ? req.body.upiId.trim().toLowerCase() : '';
    if (upiId.length > 100 || !/^[a-z0-9][a-z0-9._-]{1,80}@[a-z0-9][a-z0-9.-]{1,30}$/.test(upiId)) return res.status(400).json({ success: false, error: 'Enter a valid UPI ID, for example name@bank.' });
    const ref = getFirestore(firebaseAdminApp).collection('users').doc(identity.uid);
    const snap = await ref.get();
    if (!snap.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(snap.data()?.role || ''))) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    await ref.update({ paymentUpiId: upiId, paymentUpiUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, upiId, payeeName: String(snap.data()?.displayName || '').slice(0, 80) });
  } catch (error) {
    console.error('Partner payment profile update failed:', error);
    return res.status(500).json({ success: false, error: 'UPI ID could not be saved securely.' });
  }
});

// Partner recharge: package prices are server-owned; payments are verified against Razorpay before subscription activation.
app.get('/api/partners/recharge/packages', authenticateFirebaseUser, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Recharge is temporarily unavailable.' });
    const snap = await getFirestore(firebaseAdminApp).collection('settings').doc('partner_recharge').get();
    const configured = snap.data()?.packages;
    const trialDays = Number.isInteger(snap.data()?.trialDays) ? snap.data()!.trialDays : 30;
    const packages = Array.isArray(configured) ? configured.filter((p: any) =>
      p && p.active === true && typeof p.id === 'string' && typeof p.name === 'string' &&
      Number.isInteger(p.amountPaise) && p.amountPaise >= 100 && p.amountPaise <= 100000000 &&
      Number.isInteger(p.durationDays) && p.durationDays >= 1 && p.durationDays <= 3650
    ).map((p: any) => ({ id: p.id, name: p.name, amountPaise: p.amountPaise, durationDays: p.durationDays, currency: 'INR' })) : [];
    return res.json({ success: true, trialDays, packages });
  } catch (error) {
    console.error('Recharge packages read failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge packages could not be loaded.' });
  }
});

app.get('/api/admin/partner-recharge/packages', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Recharge settings are unavailable.' });
    const snap = await getFirestore(firebaseAdminApp).collection('settings').doc('partner_recharge').get();
    const data = snap.data() || {};
    const packages = Array.isArray(data.packages) ? data.packages.map((p: any) => ({
      id: p.id, name: p.name, amountRupees: Number.isInteger(p.amountPaise) ? p.amountPaise / 100 : 0,
      durationDays: p.durationDays, active: p.active === true
    })) : [];
    return res.json({ success: true, trialDays: Number.isInteger(data.trialDays) ? data.trialDays : 30, packages });
  } catch (error) {
    console.error('Admin recharge settings read failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge settings could not be loaded.' });
  }
});

app.put('/api/admin/partner-recharge/packages', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Recharge settings are unavailable.' });
    const packages = req.body?.packages;
    const trialDays = req.body?.trialDays;
    if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return res.status(400).json({ success: false, error: 'Free trial limit must be between 0 and 365 days.' });
    if (!Array.isArray(packages) || packages.length < 1 || packages.length > 20) return res.status(400).json({ success: false, error: 'Provide between 1 and 20 packages.' });
    const ids = new Set<string>();
    const clean = [];
    for (const p of packages) {
      if (!p || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(p.id) || ids.has(p.id) ||
          typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 80 ||
          !Number.isInteger(p.amountRupees) || p.amountRupees < 1 || p.amountRupees > 1000000 ||
          !Number.isInteger(p.durationDays) || p.durationDays < 1 || p.durationDays > 3650 ||
          typeof p.active !== 'boolean') return res.status(400).json({ success: false, error: 'A package has invalid ID, name, amount, duration or active status.' });
      ids.add(p.id);
      clean.push({ id: p.id, name: p.name.trim(), amountPaise: p.amountRupees * 100, durationDays: p.durationDays, active: p.active });
    }
    await getFirestore(firebaseAdminApp).collection('settings').doc('partner_recharge').set({ packages: clean, trialDays, updatedAt: FieldValue.serverTimestamp(), updatedBy: (req as AuthenticatedRequest).firebaseUser!.uid }, { merge: true });
    return res.json({ success: true, trialDays, packages: clean.map(p => ({ id: p.id, name: p.name, amountPaise: p.amountPaise, durationDays: p.durationDays, active: p.active })) });
  } catch (error) {
    console.error('Recharge packages update failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge packages could not be saved.' });
  }
});

app.post('/api/partners/recharge/orders', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Recharge is temporarily unavailable.' });
    const cfg = razorpayConfig();
    if (!cfg) return res.status(503).json({ success: false, error: 'Razorpay is not configured; no payment was collected.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const db = getFirestore(firebaseAdminApp);
    const profileRef = db.collection('users').doc(uid);
    const [profile, setting] = await Promise.all([profileRef.get(), db.collection('settings').doc('partner_recharge').get()]);
    if (!profile.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(profile.data()?.role || ''))) return res.status(403).json({ success: false, error: 'Channel Partner account required.' });
    const packageId = typeof req.body?.packageId === 'string' ? req.body.packageId : '';
    const pkg = (Array.isArray(setting.data()?.packages) ? setting.data()!.packages : []).find((p: any) => p?.id === packageId && p.active === true);
    if (!pkg || !Number.isInteger(pkg.amountPaise) || !Number.isInteger(pkg.durationDays)) return res.status(400).json({ success: false, error: 'Select an active recharge package.' });
    const ref = db.collection('partner_recharge_payments').doc();
    const response = await razorpayFetch('https://api.razorpay.com/v1/orders', cfg, { method: 'POST', body: JSON.stringify({ amount: pkg.amountPaise, currency: 'INR', receipt: 'qfr_' + ref.id.slice(0, 32), notes: { rechargeId: ref.id, partnerUid: uid, packageId: pkg.id } }) });
    const order = await response.json().catch(() => ({})) as any;
    if (!response.ok || typeof order.id !== 'string' || order.amount !== pkg.amountPaise || order.currency !== 'INR') return res.status(502).json({ success: false, error: 'Razorpay order creation failed; no payment was collected.' });
    await ref.create({ partnerUid: uid, packageId: pkg.id, packageName: pkg.name, amountPaise: pkg.amountPaise, durationDays: pkg.durationDays, currency: 'INR', orderId: order.id, status: 'created', createdAt: FieldValue.serverTimestamp() });
    return res.status(201).json({ success: true, rechargeId: ref.id, orderId: order.id, amount: pkg.amountPaise, currency: 'INR', keyId: cfg.keyId, mode: cfg.mode });
  } catch (error) {
    console.error('Partner recharge order failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge order could not be created.' });
  }
});

app.post('/api/partners/recharge/verify', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Recharge verification is unavailable.' });
    const cfg = razorpayConfig();
    if (!cfg) return res.status(503).json({ success: false, error: 'Razorpay is not configured.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const { rechargeId, orderId, paymentId, signature } = req.body ?? {};
    if (![rechargeId, orderId, paymentId, signature].every(v => typeof v === 'string' && v.length > 0 && v.length <= 200)) return res.status(400).json({ success: false, error: 'Invalid payment verification details.' });
    if (!validHmac(cfg.keySecret, orderId + '|' + paymentId, signature)) return res.status(400).json({ success: false, error: 'Invalid payment signature.' });
    const db = getFirestore(firebaseAdminApp), rechargeRef = db.collection('partner_recharge_payments').doc(rechargeId);
    const snap = await rechargeRef.get(), record = snap.data();
    if (!snap.exists || record?.partnerUid !== uid || record?.orderId !== orderId) return res.status(404).json({ success: false, error: 'Recharge order not found.' });
    const paymentResponse = await razorpayFetch('https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId), cfg);
    const payment = await paymentResponse.json().catch(() => ({})) as any;
    if (!paymentResponse.ok || payment.order_id !== orderId || payment.status !== 'captured' || payment.currency !== 'INR' || payment.amount !== record.amountPaise) return res.status(409).json({ success: false, error: 'Razorpay has not confirmed the exact captured amount.' });
    await db.runTransaction(async tx => {
      const [fresh, profile] = await Promise.all([tx.get(rechargeRef), tx.get(db.collection('users').doc(uid))]);
      if (!fresh.exists || fresh.data()?.partnerUid !== uid || fresh.data()?.orderId !== orderId) throw new Error('RECHARGE_CHANGED');
      if (fresh.data()?.status === 'paid') return;
      if (!profile.exists) throw new Error('PARTNER_MISSING');
      const now = Date.now(), currentExpiry = profile.data()?.subscriptionExpiresAt?.toMillis?.() || 0;
      const start = Math.max(now, currentExpiry);
      const expiry = new Date(start + Number(fresh.data()?.durationDays) * 86400000);
      tx.update(rechargeRef, { status: 'paid', paymentId, verifiedAt: FieldValue.serverTimestamp() });
      tx.update(db.collection('users').doc(uid), { subscriptionStatus: 'active', subscriptionExpiresAt: expiry, subscriptionUpdatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection('partner_recharge_ledger').doc(rechargeId), { partnerUid: uid, rechargeId, orderId, paymentId, amountPaise: fresh.data()?.amountPaise, currency: 'INR', durationDays: fresh.data()?.durationDays, status: 'paid', createdAt: FieldValue.serverTimestamp() });
    });
    return res.json({ success: true, paymentStatus: 'paid' });
  } catch (error) {
    console.error('Partner recharge verification failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge could not be activated safely.' });
  }
});

// Customer booking creation: server derives the service price and customer identity.
// No client-supplied role, price, OTP, assignment, payment or wallet value is trusted.
app.post('/api/bookings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { serviceId, scheduledDate, scheduledTimeSlot, address, notes, paymentMethod, serviceArea, quantity, customerLocation } = req.body ?? {};
    const requestedLines = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [{ serviceId, quantity }];
    const validCustomerLocation = customerLocation === undefined || (
      customerLocation !== null && typeof customerLocation === 'object' && !Array.isArray(customerLocation) &&
      typeof customerLocation.latitude === 'number' && Number.isFinite(customerLocation.latitude) &&
      customerLocation.latitude >= -90 && customerLocation.latitude <= 90 &&
      typeof customerLocation.longitude === 'number' && Number.isFinite(customerLocation.longitude) &&
      customerLocation.longitude >= -180 && customerLocation.longitude <= 180
    );
    const validServiceArea = serviceArea !== null && typeof serviceArea === 'object' && !Array.isArray(serviceArea) &&
      ['state', 'district', 'tehsil'].every((key) => typeof serviceArea[key] === 'string' && serviceArea[key].trim().length > 0 && serviceArea[key].trim().length <= 100) &&
      ['stateCode', 'districtCode', 'tehsilCode'].every((key) => serviceArea[key] === undefined || (typeof serviceArea[key] === 'string' && serviceArea[key].trim().length <= 30)) &&
      (['stateCode', 'districtCode', 'tehsilCode'].every((key) => typeof serviceArea[key] === 'string' && serviceArea[key].trim().length > 0) ||
       ['stateCode', 'districtCode', 'tehsilCode'].every((key) => serviceArea[key] === undefined));
    const validLines = Array.isArray(requestedLines) && requestedLines.length >= 1 && requestedLines.length <= 20 &&
      requestedLines.every((line: any) => line && typeof line.serviceId === 'string' && line.serviceId.length <= 120 &&
        Number.isFinite(line.quantity) && line.quantity > 0 && line.quantity <= 100000);
    const invalidFields: string[] = [];
    if (!validCustomerLocation) invalidFields.push('customerLocation');
    if (!validServiceArea) invalidFields.push('serviceArea (state, district, tehsil)');
    if (!validLines) invalidFields.push('lineItems (service and quantity)');
    if (typeof scheduledDate !== 'string' || !isValidBookingDate(scheduledDate)) invalidFields.push('scheduledDate');
    if (typeof scheduledTimeSlot !== 'string' || !/^[\p{L}\p{N}\s:().,+-]{1,80}$/u.test(scheduledTimeSlot)) invalidFields.push('scheduledTimeSlot');
    if (typeof address !== 'string' || !address.trim() || address.length > 500) invalidFields.push('address');
    if (!['upi', 'cash'].includes(paymentMethod)) invalidFields.push('paymentMethod');
    if (notes !== undefined && typeof notes !== 'string') invalidFields.push('notes');
    if (invalidFields.length) {
      return res.status(400).json({
        success: false,
        error: 'Booking details are invalid.',
        invalidFields
      });
    }
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking is temporarily unavailable.' });

    const db = getFirestore(firebaseAdminApp);
    const profileSnap = await db.collection('users').doc(identity.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== 'CUSTOMER') {
      return res.status(403).json({ success: false, error: 'A registered customer profile is required to book a service.' });
    }
    const profile = profileSnap.data()!;
    const resolvedLines = requestedLines.map((line: any) => {
      const service = INITIAL_SERVICES.find((item) => item.id === line.serviceId);
      if (!service) throw new Error('INVALID_BOOKING_SERVICE');
      return { service, quantity: Number(line.quantity), billing: getBillingProfile(service) };
    });
    const approvedRateSnapshot = await db.collection('rate_cards').where('approvalStatus', '==', 'approved').limit(500).get();
    const approvedCards = approvedRateSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as LocationRateCard));
    const lineItems: Array<{
      serviceId: string;
      serviceTitle: string;
      category: typeof INITIAL_SERVICES[number]['category'];
      quantity: number;
      billingUnit: BillingUnit;
      pricingStatus: string;
      rateCardId?: string;
      unitRateMinimum?: number;
      unitRateMaximum?: number;
      lineTotalMinimum: number;
      lineTotalMaximum: number;
      materialsIncluded?: boolean;
      rateSourceName?: string;
      rateSourceUrl?: string | null;
      rateEffectiveFrom?: string;
      rateEffectiveTo?: string | null;
    }> = resolvedLines.map(({ service, quantity, billing }) => {
      const matchingCards = approvedCards.filter(card =>
        card.state.trim().toLocaleLowerCase('en-IN') === serviceArea.state.trim().toLocaleLowerCase('en-IN') &&
        card.district.trim().toLocaleLowerCase('en-IN') === serviceArea.district.trim().toLocaleLowerCase('en-IN') &&
        card.serviceCategory === service.category && card.unit === billing.unit);
      const card = resolveLocationRateCard(
        matchingCards,
        { state: serviceArea.state, district: serviceArea.district, city: String(profile.city || ''), tehsil: serviceArea.tehsil },
        service.category, service.id, billing.unit, scheduledDate
      );
      const quote = card ? calculateRateQuote(card, quantity) : null;
      return {
        serviceId: service.id,
        serviceTitle: service.title,
        category: service.category,
        quantity,
        billingUnit: billing.unit,
        pricingStatus: quote && card ? 'priced_from_published_rate' : 'inspection_quote_required',
        ...(card && quote ? {
          rateCardId: card.id,
          unitRateMinimum: card.minimumRate,
          unitRateMaximum: card.maximumRate,
          lineTotalMinimum: quote.totalMinimum,
          lineTotalMaximum: quote.totalMaximum,
          materialsIncluded: quote.materialsIncluded,
          rateSourceName: card.sourceName,
          rateSourceUrl: card.sourceUrl || null,
          rateEffectiveFrom: card.effectiveFrom,
          rateEffectiveTo: card.effectiveTo || null
        } : { lineTotalMinimum: 0, lineTotalMaximum: 0 })
      };
    });
    const allLinesPriced = lineItems.every(line => line.pricingStatus === 'priced_from_published_rate');
    const totalMinimum = lineItems.reduce((sum, line) => sum + line.lineTotalMinimum, 0);
    const totalMaximum = lineItems.reduce((sum, line) => sum + line.lineTotalMaximum, 0);
    const primary = resolvedLines[0];
    const rateCardIds = [...new Set(lineItems.map(line => line.rateCardId).filter(Boolean))];
    const bookingRef = db.collection('bookings').doc();
    await bookingRef.create({
      id: bookingRef.id,
      customerUid: identity.uid,
      customerName: String(profile.displayName || '').slice(0, 100),
      customerPhone: identity.phone_number || String(profile.phoneNumber || '').slice(0, 30),
      customerAddress: address.trim(),
      serviceId: primary.service.id,
      serviceTitle: primary.service.title,
      category: primary.service.category,
      lineItems,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
      scheduledDate,
      scheduledTimeSlot,
      city: String(profile.city || '').slice(0, 100),
      pincode: String(profile.pincode || '').slice(0, 12),
      serviceArea: { state: serviceArea.state.trim(), district: serviceArea.district.trim(), tehsil: serviceArea.tehsil.trim() },
      ...(customerLocation ? { customerLocation: { latitude: customerLocation.latitude, longitude: customerLocation.longitude, capturedAt: FieldValue.serverTimestamp() } } : {}),
      quantity: primary.quantity,
      billingUnit: primary.billing.unit,
      pricingStatus: allLinesPriced ? 'estimated_from_approved_rate_card' : 'quote_required',
      ...(allLinesPriced ? {
        rateCardId: rateCardIds[0],
        rateCardIds,
        quoteRange: { minimum: totalMinimum, maximum: totalMaximum, materialsIncluded: lineItems.every(line => line.materialsIncluded === true), lineItems }
      } : { rateCardIds, quoteRange: { minimum: totalMinimum, maximum: totalMaximum, lineItems } }),
      paymentMethod,
      status: 'requested',
      startOtp: '',
      price: allLinesPriced ? totalMinimum : 0,
      totalAmount: allLinesPriced ? totalMinimum : 0,
      paymentCollectionEnabled: false,
      paymentStatus: 'pending',
      escrowStatus: 'not_funded',
      createdAt: FieldValue.serverTimestamp()
    });
    return res.status(201).json({ success: true, bookingId: bookingRef.id, pricingStatus: allLinesPriced ? 'priced' : 'inspection_quote_required', quoteRange: { minimum: totalMinimum, maximum: totalMaximum }, lineItems });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_BOOKING_SERVICE') return res.status(400).json({ success: false, error: 'One or more selected services are unavailable.' });
    console.error('Secure booking creation failed:', error);
    return res.status(500).json({ success: false, error: 'Booking could not be saved securely. Please retry.' });
  }
});

const razorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  const mode = (process.env.RAZORPAY_MODE || 'test').trim().toLowerCase();
  if (!keyId || !keySecret || !['test', 'live'].includes(mode)) return null;
  if (mode === 'test' && !keyId.startsWith('rzp_test_')) return null;
  if (mode === 'live' && !keyId.startsWith('rzp_live_')) return null;
  return { keyId, keySecret, mode };
};
const validHmac = (secret: string, message: Buffer | string, supplied: string) => {
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(message).digest();
  const actual = Buffer.from(supplied, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const razorpayFetch = (url: string, cfg: {keyId:string;keySecret:string}, init?: RequestInit) =>
  fetch(url, { ...init, signal: init?.signal || AbortSignal.timeout(15000), headers: { Authorization: 'Basic ' + Buffer.from(cfg.keyId + ':' + cfg.keySecret).toString('base64'), 'Content-Type':'application/json', ...(init?.headers || {}) } });

// Safe payment readiness diagnostic. Never returns key IDs, secrets, or webhook values.
app.get('/api/payments/razorpay/status', authenticateFirebaseUser, (_req: Request, res: Response) => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  const mode = (process.env.RAZORPAY_MODE || 'test').trim().toLowerCase();
  const validMode = mode === 'test' || mode === 'live';
  const validKeyPrefix = mode === 'test'
    ? keyId.startsWith('rzp_test_')
    : mode === 'live' && keyId.startsWith('rzp_live_');
  const checks = {
    keyIdPresent: Boolean(keyId),
    keySecretPresent: Boolean(keySecret),
    keyModeMatches: Boolean(keyId && validMode && validKeyPrefix),
    webhookSecretPresent: Boolean(webhookSecret),
    modeValid: validMode
  };
  const ready = Object.values(checks).every(Boolean);
  return res.json({
    success: true,
    provider: 'razorpay',
    mode: validMode ? mode : 'invalid',
    configured: ready,
    checks,
    missing: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
    note: ready
      ? 'Credentials are present. A real test payment is still required before enabling live payments.'
      : 'Payment is safely disabled until the missing server-side configuration is completed.'
  });
});

app.post('/api/payments/razorpay/orders', authenticateFirebaseUser, async (req: Request, res: Response) => {
  const cfg = razorpayConfig();
  if (!cfg || !firebaseAdminApp) return res.status(503).json({success:false,error:'Razorpay Test Mode credentials are not safely configured.'});
  const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
  const bookingId = typeof req.body?.bookingId === 'string' ? req.body.bookingId.trim() : '';
  if (!bookingId || bookingId.length > 128) return res.status(400).json({success:false,error:'Valid booking ID required.'});
  const db = getFirestore(firebaseAdminApp), bookingRef = db.collection('bookings').doc(bookingId);
  const attemptRef = db.collection('razorpay_payment_attempts').doc(bookingId);
  let ownsAttemptLock = false;
  try {
    const snap = await bookingRef.get();
    if (!snap.exists) return res.status(404).json({success:false,error:'Booking not found.'});
    const b = snap.data()!;
    if (b.customerUid !== uid) return res.status(403).json({success:false,error:'Booking ownership check failed.'});
    if (b.paymentMethod !== 'upi' || b.status !== 'requested' || b.paymentStatus !== 'pending') return res.status(409).json({success:false,error:'Booking is not eligible for online payment.'});
    if (b.pricingStatus !== 'estimated_from_approved_rate_card' || !b.rateCardId) return res.status(409).json({success:false,error:'Payment requires an approved local rate card.'});
    const rupees = Number(b.totalAmount), paise = Math.round(rupees * 100);
    if (!Number.isFinite(rupees) || paise < 100 || paise > 100000000 || Math.abs(paise / 100 - rupees) > 0.000001) return res.status(409).json({success:false,error:'Approved booking amount is invalid.'});
    if (b.paymentOrderId && b.paymentOrderStatus === 'created' && b.paymentOrderAmount === paise && b.paymentOrderCurrency === 'INR') return res.json({success:true,orderId:b.paymentOrderId,amount:b.paymentOrderAmount,currency:'INR',keyId:cfg.keyId,mode:cfg.mode});
    const reserved = await db.runTransaction(async tx => {
      const [fresh, attempt] = await Promise.all([tx.get(bookingRef),tx.get(attemptRef)]);
      if (!fresh.exists || fresh.data()?.customerUid !== uid) throw new Error('BOOKING_NOT_FOUND');
      if (fresh.data()?.paymentOrderId && fresh.data()?.paymentOrderStatus === 'created' && fresh.data()?.paymentOrderAmount === paise && fresh.data()?.paymentOrderCurrency === 'INR') return String(fresh.data()!.paymentOrderId);
      const lockUpdatedAt = attempt.data()?.updatedAt;
      const lockAgeMs = lockUpdatedAt && typeof lockUpdatedAt.toMillis === 'function' ? Date.now() - lockUpdatedAt.toMillis() : Number.POSITIVE_INFINITY;
      if (attempt.exists && attempt.data()?.status === 'creating' && lockAgeMs < 120000) throw new Error('ORDER_IN_PROGRESS');
      tx.set(attemptRef,{status:'creating',customerUid:uid,bookingId,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return '';
    });
    if (reserved) return res.json({success:true,orderId:reserved,amount:paise,currency:'INR',keyId:cfg.keyId,mode:cfg.mode});
    ownsAttemptLock = true;
    const response = await razorpayFetch('https://api.razorpay.com/v1/orders',cfg,{method:'POST',body:JSON.stringify({amount:paise,currency:'INR',receipt:'qf_'+bookingId.slice(0,32),notes:{bookingId,customerUid:uid}})});
    const order = await response.json().catch(()=>({})) as any;
    if (!response.ok || typeof order.id !== 'string' || order.amount !== paise || order.currency !== 'INR') {
      await attemptRef.set({status:'failed',updatedAt:FieldValue.serverTimestamp()},{merge:true});
      console.error('Razorpay order rejected:',response.status,order?.error?.code || 'unknown');
      return res.status(502).json({success:false,error:'Order creation failed. No payment was collected.'});
    }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(bookingRef);
      if (!fresh.exists || fresh.data()?.customerUid !== uid || fresh.data()?.paymentStatus !== 'pending') throw new Error('BOOKING_CHANGED');
      tx.update(bookingRef,{paymentOrderId:order.id,paymentOrderAmount:paise,paymentOrderCurrency:'INR',paymentOrderStatus:'created',paymentCollectionEnabled:true,paymentProvider:'razorpay',paymentMode:cfg.mode,paymentUpdatedAt:FieldValue.serverTimestamp()});
      tx.set(attemptRef,{status:'created',orderId:order.id,amount:paise,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    });
    return res.status(201).json({success:true,orderId:order.id,amount:paise,currency:'INR',keyId:cfg.keyId,mode:cfg.mode});
  } catch(e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'ORDER_IN_PROGRESS') return res.status(409).json({success:false,error:'Order creation is in progress. Retry shortly.'});
    if (msg === 'BOOKING_NOT_FOUND') return res.status(404).json({success:false,error:'Booking not found.'});
    if (ownsAttemptLock) await attemptRef.set({status:'failed',updatedAt:FieldValue.serverTimestamp()},{merge:true}).catch(() => undefined);
    console.error('Razorpay order route failed:',e);
    return res.status(500).json({success:false,error:'Order creation failed. No payment was collected.'});
  }
});

app.post('/api/payments/razorpay/verify', authenticateFirebaseUser, async (req: Request, res: Response) => {
  const cfg = razorpayConfig();
  if (!cfg || !firebaseAdminApp) return res.status(503).json({success:false,error:'Payment verification is unavailable.'});
  const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
  const {bookingId,orderId,paymentId,signature} = req.body ?? {};
  if (![bookingId,orderId,paymentId,signature].every(v=>typeof v==='string' && v.length>0 && v.length<=200)) return res.status(400).json({success:false,error:'Invalid verification details.'});
  if (!validHmac(cfg.keySecret,orderId+'|'+paymentId,signature)) return res.status(400).json({success:false,error:'Invalid payment signature.'});
  try {
    const db=getFirestore(firebaseAdminApp), ref=db.collection('bookings').doc(bookingId), snap=await ref.get();
    if (!snap.exists || snap.data()?.customerUid!==uid) return res.status(404).json({success:false,error:'Booking not found.'});
    const b=snap.data()!;
    if (b.paymentOrderId!==orderId || b.paymentProvider!=='razorpay' || b.paymentOrderCurrency!=='INR') return res.status(409).json({success:false,error:'Order does not match booking.'});
    const response=await razorpayFetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId),cfg);
    const p=await response.json().catch(()=>({})) as any;
    if (!response.ok || p.order_id!==orderId || p.status!=='captured' || p.currency!=='INR' || p.amount!==b.paymentOrderAmount) return res.status(409).json({success:false,error:'Gateway has not confirmed the exact captured amount.'});
    await db.runTransaction(async tx=>{
      const fresh=await tx.get(ref);
      if (!fresh.exists || fresh.data()?.customerUid!==uid || fresh.data()?.paymentOrderId!==orderId) throw new Error('BOOKING_CHANGED');
      if (fresh.data()?.paymentStatus==='paid') return;
      tx.update(ref,{paymentStatus:'paid',escrowStatus:'not_funded',paymentId,paymentCapturedAt:FieldValue.serverTimestamp(),paymentUpdatedAt:FieldValue.serverTimestamp()});
    });
    return res.json({success:true,paymentStatus:'paid'});
  } catch(e) { console.error('Razorpay verification failed:',e); return res.status(500).json({success:false,error:'Payment verification could not be completed safely.'}); }
});

app.post('/api/webhooks/razorpay', async (req: Request, res: Response) => {
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  const raw=(req as Request & {rawBody?:Buffer}).rawBody;
  const signature=String(req.headers['x-razorpay-signature'] || '');
  const eventId=String(req.headers['x-razorpay-event-id'] || '');
  if (!secret || !raw || !eventId || eventId.length>200) return res.status(503).json({success:false,error:'Webhook is not configured.'});
  if (!validHmac(secret,raw,signature)) return res.status(400).json({success:false,error:'Invalid webhook signature.'});
  if (!firebaseAdminApp) return res.status(503).json({success:false,error:'Payment ledger unavailable.'});
  try {
    const event=req.body?.event, p=req.body?.payload?.payment?.entity, o=req.body?.payload?.order?.entity;
    if (!['payment.captured','order.paid'].includes(event)) return res.json({success:true,ignored:true});
    const orderId=p?.order_id || o?.id, paymentId=p?.id || o?.payments?.[0]?.id, amount=p?.amount ?? o?.amount_paid, currency=p?.currency || o?.currency || 'INR';
    if (typeof orderId!=='string' || typeof paymentId!=='string' || !Number.isInteger(amount) || currency!=='INR') return res.status(400).json({success:false,error:'Incomplete payment event.'});
    const db=getFirestore(firebaseAdminApp), eventRef=db.collection('razorpay_webhook_events').doc(eventId);
    const rechargeMatches=await db.collection('partner_recharge_payments').where('orderId','==',orderId).limit(1).get();
    if (!rechargeMatches.empty) {
      const rechargeRef=rechargeMatches.docs[0]!.ref;
      await db.runTransaction(async tx=>{
        const [seen,rSnap]=await Promise.all([tx.get(eventRef),tx.get(rechargeRef)]);
        if (seen.exists) return;
        if (!rSnap.exists) throw new Error('RECHARGE_NOT_FOUND');
        const r=rSnap.data()!;
        if (r.orderId!==orderId || r.amountPaise!==amount || r.currency!=='INR') throw new Error('RECHARGE_AMOUNT_MISMATCH');
        if (r.status!=='paid') {
          const partnerRef=db.collection('users').doc(String(r.partnerUid || ''));
          const partner=await tx.get(partnerRef);
          if (!partner.exists) throw new Error('PARTNER_NOT_FOUND');
          const now=Date.now(), currentExpiry=partner.data()?.subscriptionExpiresAt?.toMillis?.() || 0;
          const expiry=new Date(Math.max(now,currentExpiry)+Number(r.durationDays)*86400000);
          tx.update(rechargeRef,{status:'paid',paymentId,verifiedAt:FieldValue.serverTimestamp(),verifiedBy:'razorpay_webhook'});
          tx.update(partnerRef,{subscriptionStatus:'active',subscriptionExpiresAt:expiry,subscriptionUpdatedAt:FieldValue.serverTimestamp()});
          tx.create(db.collection('partner_recharge_ledger').doc(rechargeRef.id),{partnerUid:r.partnerUid,rechargeId:rechargeRef.id,orderId,paymentId,amountPaise:r.amountPaise,currency:'INR',durationDays:r.durationDays,status:'paid',source:'webhook',createdAt:FieldValue.serverTimestamp()});
        } else if (r.paymentId && r.paymentId!==paymentId) {
          throw new Error('RECHARGE_PAYMENT_CONFLICT');
        }
        tx.create(eventRef,{eventId,event,orderId,paymentId,processedAt:FieldValue.serverTimestamp(),kind:'partner_recharge'});
      });
      return res.json({success:true,received:true,kind:'partner_recharge'});
    }
    const matches=await db.collection('bookings').where('paymentOrderId','==',orderId).limit(1).get();
    if (matches.empty) return res.status(404).json({success:false,error:'Matching booking or recharge not found.'});
    const bookingRef=matches.docs[0]!.ref;
    await db.runTransaction(async tx=>{
      const [seen,bSnap]=await Promise.all([tx.get(eventRef),tx.get(bookingRef)]);
      if (seen.exists) return;
      if (!bSnap.exists) throw new Error('BOOKING_NOT_FOUND');
      const b=bSnap.data()!;
      if (b.paymentOrderId!==orderId || b.paymentOrderAmount!==amount || b.paymentOrderCurrency!=='INR') throw new Error('AMOUNT_MISMATCH');
      if (b.paymentStatus!=='paid') tx.update(bookingRef,{paymentStatus:'paid',escrowStatus:'not_funded',paymentId,paymentCapturedAt:FieldValue.serverTimestamp(),paymentUpdatedAt:FieldValue.serverTimestamp()});
      tx.create(eventRef,{eventId,event,orderId,paymentId,processedAt:FieldValue.serverTimestamp(),kind:'booking'});
    });
    return res.json({success:true,received:true,kind:'booking'});
  } catch(e) { console.error('Razorpay webhook failed:',e); return res.status(409).json({success:false,error:'Webhook could not be applied safely.'}); }
});

// Channel Partner job feed. It reveals only eligible, unassigned requests and never
// exposes customer contact details, notes, OTPs, payment data or the full address.
// Partner-controlled dispatch radius and GPS pin. Updates are scoped to the authenticated partner.
app.get('/api/partners/dispatch-settings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner settings are temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const snapshot = await getFirestore(firebaseAdminApp).collection('users').doc(identity.uid).get();
    if (!snapshot.exists) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    const profile = snapshot.data()!;
    return res.json({ success: true, dispatchRadiusKm: typeof profile.dispatchRadiusKm === 'number' ? profile.dispatchRadiusKm : 5, locationConfigured: Boolean(profile.dispatchLocation) });
  } catch (error) {
    console.error('Partner dispatch settings read failed:', error);
    return res.status(500).json({ success: false, error: 'Partner settings could not be loaded.' });
  }
});

app.put('/api/partners/dispatch-settings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner settings are temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { dispatchRadiusKm, dispatchLocation } = req.body ?? {};
    const validPoint = dispatchLocation && typeof dispatchLocation === 'object' && !Array.isArray(dispatchLocation) &&
      typeof dispatchLocation.latitude === 'number' && Number.isFinite(dispatchLocation.latitude) && dispatchLocation.latitude >= -90 && dispatchLocation.latitude <= 90 &&
      typeof dispatchLocation.longitude === 'number' && Number.isFinite(dispatchLocation.longitude) && dispatchLocation.longitude >= -180 && dispatchLocation.longitude <= 180;
    if (![1, 3, 5, 10, 15].includes(dispatchRadiusKm) || !validPoint) return res.status(400).json({ success: false, error: 'Choose 1, 3, 5, 10 or 15 km and share a valid GPS location.' });
    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    const profile = await userRef.get();
    if (!profile.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(profile.data()?.role || ''))) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    await userRef.update({ dispatchRadiusKm, dispatchLocation: { latitude: dispatchLocation.latitude, longitude: dispatchLocation.longitude }, dispatchLocationUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, dispatchRadiusKm, locationConfigured: true });
  } catch (error) {
    console.error('Partner dispatch settings update failed:', error);
    return res.status(500).json({ success: false, error: 'Partner dispatch settings could not be saved.' });
  }
});
app.get('/api/partners/bookings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) {
      return res.status(503).json({ success: false, error: 'Secure job feed is temporarily unavailable.' });
    }
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const db = getFirestore(firebaseAdminApp);
    const profileSnap = await db.collection('users').doc(identity.uid).get();
    if (!profileSnap.exists) {
      return res.status(403).json({ success: false, error: 'A registered Channel Partner profile is required.' });
    }

    const profile = profileSnap.data()!;

    // Active assignments are fetched independently of online dispatch eligibility:
    // a partner must still be able to view a job already assigned to them after going offline.
    const [ownedByUid, ownedByLegacyId] = await Promise.all([
      db.collection('bookings').where('technicianUid', '==', identity.uid).limit(50).get(),
      db.collection('bookings').where('technicianId', '==', identity.uid).limit(50).get()
    ]);
    const assignedDocs = new Map<string, any>();
    [...ownedByUid.docs, ...ownedByLegacyId.docs].forEach((document) => assignedDocs.set(document.id, document));
    const assignedBookings = [...assignedDocs.values()]
      .filter((document) => ['assigned', 'technician_en_route', 'in_progress'].includes(String(document.data().status || '')))
      .map((document) => {
        const booking = document.data();
        return {
          id: document.id,
          serviceTitle: String(booking.serviceTitle || ''),
          category: String(booking.category || ''),
          customerName: String(booking.customerName || ''),
          customerPhone: String(booking.customerPhone || ''),
          customerAddress: String(booking.customerAddress || ''),
          city: String(booking.city || ''),
          notes: typeof booking.notes === 'string' ? booking.notes : '',
          status: String(booking.status || 'assigned'),
          price: Number(booking.price || 0),
          totalAmount: Number(booking.totalAmount || 0),
          technicianPayout: Number(booking.technicianPayout || 0),
          adminCommission: Number(booking.adminCommission || 0),
          commissionRate: Number(booking.commissionRate || 0),
          paymentMethod: String(booking.paymentMethod || ''),
          serviceDeadline: typeof booking.serviceDeadline === 'string' ? booking.serviceDeadline : '',
          acceptedAt: typeof booking.acceptedAt === 'string' ? booking.acceptedAt : '',
          createdAt: typeof booking.createdAt === 'string' ? booking.createdAt : ''
        };
      });

    const eligible = isPartnerEligibleForDispatch(profile);
    if (!eligible) {
      return res.json({ success: true, bookings: [], assignedBookings });
    }

    const city = typeof profile.city === 'string' ? profile.city.trim() : '';
    const trades = Array.isArray(profile.trades)
      ? profile.trades.filter((trade): trade is string => typeof trade === 'string')
      : [];
    if (city.length < 2 || trades.length === 0) {
      return res.status(403).json({ success: false, error: 'Your approved city and service trades are required before job access.' });
    }


    const normalizeAreaValue = (value: unknown) =>
      typeof value === 'string' ? value.trim().toLocaleLowerCase('en-IN') : '';
    const partnerArea = profile.serviceArea && typeof profile.serviceArea === 'object'
      ? profile.serviceArea as Record<string, unknown>
      : null;
    const partnerHasArea = Boolean(partnerArea &&
      ['state', 'district', 'tehsil'].every((key) => normalizeAreaValue(partnerArea[key])));

    // Query only the partner's city. Structured area matching is then applied
    // before returning requests; legacy records without complete area data use city.
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    if (cursor && !/^[A-Za-z0-9_-]{1,150}$/.test(cursor)) {
      return res.status(400).json({ success: false, error: 'Job feed cursor is invalid.' });
    }
    let bookingQuery = db.collection('bookings')
      .where('status', '==', 'requested')
      .where('city', '==', city)
      .orderBy(FieldPath.documentId());
    if (cursor) bookingQuery = bookingQuery.startAfter(cursor);
    const snapshot = await bookingQuery.limit(200).get();

    const bookings = snapshot.docs
      .filter((document) => {
        const booking = document.data();
        if (!canPartnerReceiveBookingCategory(trades, booking.category)) return false;
        if (!isWithinPartnerDispatchRadius(profile, booking)) return false;
        const bookingArea = booking.serviceArea && typeof booking.serviceArea === 'object'
          ? booking.serviceArea as Record<string, unknown>
          : null;
        const bookingHasArea = Boolean(bookingArea &&
          ['state', 'district', 'tehsil'].every((key) => normalizeAreaValue(bookingArea[key])));
        if (partnerHasArea && bookingHasArea) {
          return ['state', 'district', 'tehsil'].every((key) =>
            normalizeAreaValue(partnerArea![key]) === normalizeAreaValue(bookingArea![key])
          );
        }
        // GPS radius is always enforced; city and structured area are additional filters.
        return true;
      })
      .map((document) => {
        const booking = document.data();
        return {
          id: document.id,
          serviceTitle: String(booking.serviceTitle || ''),
          category: String(booking.category || ''),
          customerName: String(booking.customerName || ''),
          status: 'requested',
          price: Number(booking.price || 0),
          totalAmount: Number(booking.totalAmount || 0),
          paymentStatus: String(booking.paymentStatus || 'pending'),
          escrowStatus: String(booking.escrowStatus || 'not_funded')
        };
      });

    return res.json({
      success: true,
      bookings,
      assignedBookings,
      nextCursor: snapshot.size === 200 ? snapshot.docs[snapshot.docs.length - 1].id : null,
      hasMore: snapshot.size === 200
    });
  } catch (error) {
    console.error('Secure Channel Partner job feed failed:', error);
    return res.status(500).json({ success: false, error: 'Available jobs could not be loaded securely. Please retry.' });
  }
});


// Atomically claim a requested booking for the authenticated Channel Partner.
// No client-supplied partner identity, wallet, reserve, price or status is trusted.
app.post('/api/partners/bookings/:bookingId/accept', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) {
      return res.status(503).json({ success: false, error: 'Secure job acceptance is temporarily unavailable.' });
    }
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = String(req.params.bookingId || '');
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(bookingId)) {
      return res.status(400).json({ success: false, error: 'Booking ID is invalid.' });
    }

    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(identity.uid);
    const bookingRef = db.collection('bookings').doc(bookingId);
    const auditRef = db.collection('partner_job_audit_logs').doc();
    const otpRef = db.collection('booking_start_otps').doc(bookingId);
    const startOtp = String(randomInt(0, 1000000)).padStart(6, '0');
    const acceptedAt = new Date();
    const deadline = new Date(acceptedAt.getTime() + 60 * 60 * 1000);

    await db.runTransaction(async (transaction) => {
      const [partnerSnap, bookingSnap] = await Promise.all([
        transaction.get(partnerRef),
        transaction.get(bookingRef)
      ]);
      if (!partnerSnap.exists) throw new Error('PARTNER_PROFILE_NOT_FOUND');
      if (!bookingSnap.exists) throw new Error('BOOKING_NOT_FOUND');

      const partner = partnerSnap.data()!;
      const booking = bookingSnap.data()!;
      if (!isPartnerEligibleForDispatch(partner)) throw new Error('PARTNER_NOT_ELIGIBLE');

      const city = typeof partner.city === 'string' ? partner.city.trim() : '';
      const trades = Array.isArray(partner.trades)
        ? partner.trades.filter((trade): trade is string => typeof trade === 'string')
        : [];
      if (!city || booking.city !== city || !canPartnerReceiveBookingCategory(trades, booking.category)) {
        throw new Error('BOOKING_OUTSIDE_PARTNER_SCOPE');
      }

      const normalizeArea = (value: unknown) =>
        typeof value === 'string' ? value.trim().toLocaleLowerCase('en-IN') : '';
      const partnerArea = partner.serviceArea && typeof partner.serviceArea === 'object'
        ? partner.serviceArea as Record<string, unknown> : null;
      const bookingArea = booking.serviceArea && typeof booking.serviceArea === 'object'
        ? booking.serviceArea as Record<string, unknown> : null;
      const hasCompleteArea = (area: Record<string, unknown> | null) =>
        Boolean(area && ['state', 'district', 'tehsil'].every((key) => normalizeArea(area[key])));
      if (hasCompleteArea(partnerArea) && hasCompleteArea(bookingArea) &&
          !['state', 'district', 'tehsil'].every((key) =>
            normalizeArea(partnerArea![key]) === normalizeArea(bookingArea![key]))) {
        throw new Error('BOOKING_OUTSIDE_PARTNER_SCOPE');
      }
      if (!isWithinPartnerDispatchRadius(partner, booking)) {
        throw new Error('BOOKING_OUTSIDE_PARTNER_SCOPE');
      }

      if (booking.status !== 'requested' || booking.technicianUid || booking.technicianId) {
        throw new Error('BOOKING_ALREADY_CLAIMED');
      }

      transaction.update(bookingRef, {
        status: 'assigned',
        technicianUid: identity.uid,
        technicianId: identity.uid,
        technicianName: String(partner.displayName || '').slice(0, 100),
        acceptedAt: acceptedAt.toISOString(),
        serviceDeadline: deadline.toISOString(),
        assignedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(otpRef, {
        bookingId,
        customerUid: booking.customerUid,
        partnerUid: identity.uid,
        code: startOtp,
        expiresAt: new Date(acceptedAt.getTime() + 60 * 60 * 1000).toISOString(),
        createdAt: FieldValue.serverTimestamp()
      });
      transaction.create(auditRef, {
        action: 'partner_job_accepted',
        bookingId,
        partnerUid: identity.uid,
        acceptedAt: FieldValue.serverTimestamp(),
        serviceDeadline: deadline.toISOString()
      });
    });

    return res.json({
      success: true,
      bookingId,
      status: 'assigned',
      acceptedAt: acceptedAt.toISOString(),
      serviceDeadline: deadline.toISOString(),
      message: 'Job assigned successfully. The 1-hour service SLA has started.'
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PARTNER_PROFILE_NOT_FOUND') return res.status(403).json({ success: false, error: 'A registered Channel Partner profile is required.' });
    if (code === 'BOOKING_NOT_FOUND') return res.status(404).json({ success: false, error: 'Booking was not found.' });
    if (code === 'PARTNER_NOT_ELIGIBLE') return res.status(403).json({ success: false, error: 'Job acceptance requires approved KYC, online status and the fully funded ₹2,000 reserve.' });
    if (code === 'BOOKING_OUTSIDE_PARTNER_SCOPE') return res.status(403).json({ success: false, error: 'This job is outside your approved city, trade or service area.' });
    if (code === 'BOOKING_ALREADY_CLAIMED') return res.status(409).json({ success: false, error: 'This job is no longer available.' });
    console.error('Secure partner job acceptance failed:', error);
    return res.status(500).json({ success: false, error: 'Job could not be accepted securely. Please retry.' });
  }
});


// Update every active booking for a partner in bounded Firestore batches.
// Each batch stays below Firestore's 500-write limit, and document-ID cursors
// ensure bookings beyond the first page are not silently skipped.
const updateActiveBookingLocations = async (
  db: Firestore,
  partnerUid: string,
  location: { latitude: number; longitude: number; accuracyMeters?: number; updatedAt: FieldValue } | null
) => {
  const pageSize = 400;
  let lastDocument: QueryDocumentSnapshot | undefined;
  let updatedCount = 0;

  while (true) {
    let query = db.collection('bookings')
      .where('technicianUid', '==', partnerUid)
      .where('status', 'in', ['assigned', 'technician_en_route', 'in_progress'])
      .orderBy(FieldPath.documentId())
      .limit(pageSize);
    if (lastDocument) query = query.startAfter(lastDocument);

    const page = await query.get();
    if (page.empty) break;

    const batch = db.batch();
    page.docs.forEach(document => {
      if (location) {
        batch.update(document.ref, {
          partnerLocation: location,
          partnerLocationUpdatedAt: FieldValue.serverTimestamp()
        });
      } else {
        batch.update(document.ref, {
          partnerLocation: FieldValue.delete(),
          partnerLocationUpdatedAt: FieldValue.delete()
        });
      }
    });
    await batch.commit();
    updatedCount += page.size;
    lastDocument = page.docs[page.docs.length - 1];
    if (page.size < pageSize) break;
  }

  return updatedCount;
};

// Partner live-location sharing is opt-in and limited to the partner's active assigned jobs.
app.post('/api/partners/location', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure location service is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { shareLocation, latitude, longitude, accuracyMeters } = req.body ?? {};
    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(identity.uid);
    const partnerSnap = await partnerRef.get();
    if (!partnerSnap.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(partnerSnap.data()?.role || ''))) {
      return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    }

    const partner = partnerSnap.data()!;
    if (shareLocation === false) {
      const clearedBookings = await updateActiveBookingLocations(db, identity.uid, null);
      await partnerRef.update({
        locationSharingEnabled: false,
        liveLocation: FieldValue.delete(),
        liveLocationUpdatedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.json({ success: true, sharingEnabled: false, clearedBookings });
    }

    const validPoint = typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
      typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    const validAccuracy = accuracyMeters === undefined ||
      (typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters) && accuracyMeters >= 0 && accuracyMeters <= 1000);
    if (shareLocation !== true || !validPoint || !validAccuracy) {
      return res.status(400).json({ success: false, error: 'Explicit location sharing consent and valid GPS coordinates are required.' });
    }

    const location = {
      latitude,
      longitude,
      ...(typeof accuracyMeters === 'number' ? { accuracyMeters } : {}),
      updatedAt: FieldValue.serverTimestamp()
    };
    const updatedBookings = await updateActiveBookingLocations(db, identity.uid, location);
    if (updatedBookings === 0) {
      return res.status(409).json({ success: false, error: 'Live location can be shared only while you have an active assigned job.' });
    }
    await partnerRef.update({
      locationSharingEnabled: true,
      liveLocation: location,
      liveLocationUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.json({ success: true, sharingEnabled: true, updatedBookings, message: 'Live location shared with customers on your active assigned jobs.' });
  } catch (error) {
    console.error('Secure partner live-location update failed:', error);
    return res.status(500).json({ success: false, error: 'Live location could not be updated securely.' });
  }
});

// Return only the authenticated customer's own bookings; private OTPs are fetched separately.
app.get('/api/customer/bookings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const snapshot = await getFirestore(firebaseAdminApp).collection('bookings')
      .where('customerUid', '==', identity.uid)
      .limit(50)
      .get();
    const bookings = snapshot.docs.map((doc) => {
      const booking = doc.data();
      const createdAt = booking.createdAt && typeof booking.createdAt.toDate === 'function'
        ? booking.createdAt.toDate().toISOString()
        : String(booking.createdAt || '');
      return {
        id: doc.id,
        serviceTitle: String(booking.serviceTitle || booking.serviceName || 'QuickFix Service'),
        category: String(booking.category || ''),
        customerAddress: String(booking.customerAddress || booking.address || ''),
        scheduledDate: String(booking.scheduledDate || ''),
        scheduledTimeSlot: String(booking.scheduledTimeSlot || ''),
        status: String(booking.status || 'requested'),
        technicianName: String(booking.technicianName || ''),
        serviceDeadline: String(booking.serviceDeadline || ''),
        createdAt
      };
    }).sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return res.json({ success: true, bookings });
  } catch (error) {
    console.error('Customer booking feed failed:', error);
    return res.status(500).json({ success: false, error: 'Customer bookings could not be loaded securely.' });
  }
});

// Customers can read only the live location attached to their own active booking.
// Locations older than five minutes are deliberately reported as stale, not presented as live.
app.get('/api/customer/bookings/:bookingId/partner-location', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure location service is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = String(req.params.bookingId || '');
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(bookingId)) return res.status(400).json({ success: false, error: 'Booking ID is invalid.' });
    const bookingSnap = await getFirestore(firebaseAdminApp).collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists || bookingSnap.data()?.customerUid !== identity.uid) {
      return res.status(404).json({ success: false, error: 'Booking was not found for this customer.' });
    }
    const booking = bookingSnap.data()!;
    if (!['assigned', 'technician_en_route', 'in_progress'].includes(String(booking.status || ''))) {
      return res.status(409).json({ success: false, error: 'Partner live location is available only for an active assigned booking.' });
    }
    const point = booking.partnerLocation;
    const updatedAt = booking.partnerLocationUpdatedAt;
    if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number' || !updatedAt || typeof updatedAt.toMillis !== 'function') {
      return res.json({ success: true, available: false, sharingEnabled: false });
    }
    const ageMs = Math.max(0, Date.now() - updatedAt.toMillis());
    const stale = ageMs > 5 * 60 * 1000;
    return res.json({
      success: true,
      available: !stale,
      stale,
      sharingEnabled: true,
      location: stale ? null : {
        latitude: point.latitude,
        longitude: point.longitude,
        ...(typeof point.accuracyMeters === 'number' ? { accuracyMeters: point.accuracyMeters } : {}),
        updatedAt: updatedAt.toDate().toISOString()
      },
      ageSeconds: Math.floor(ageMs / 1000)
    });
  } catch (error) {
    console.error('Customer partner live-location read failed:', error);
    return res.status(500).json({ success: false, error: 'Partner location could not be loaded securely.' });
  }
});

// Customer-only retrieval of the server-issued service-start OTP.
app.get('/api/customer/bookings/:bookingId/start-otp', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = String(req.params.bookingId || '');
    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(bookingId);
    const [bookingSnap, otpSnap] = await Promise.all([
      bookingRef.get(),
      db.collection('booking_start_otps').doc(bookingId).get()
    ]);
    if (!bookingSnap.exists || bookingSnap.data()?.customerUid !== identity.uid) {
      return res.status(404).json({ success: false, error: 'Booking was not found for this customer.' });
    }
    if (!isStartOtpBookingStatus(bookingSnap.data()?.status) || !otpSnap.exists) {
      return res.status(409).json({ success: false, error: 'The service-start code is not available yet.' });
    }
    const otp = otpSnap.data()!;
    if (otp.customerUid !== identity.uid || otp.partnerUid !== bookingSnap.data()?.technicianUid ||
        !isStartOtpBookingStatus(bookingSnap.data()?.status) ||
        isStartOtpExpired(otp.expiresAt)) {
      return res.status(410).json({ success: false, error: 'The service-start code has expired.' });
    }
    return res.json({ success: true, startOtp: String(otp.code) });
  } catch (error) {
    console.error('Customer start OTP retrieval failed:', error);
    return res.status(500).json({ success: false, error: 'The service-start code could not be loaded.' });
  }
});

// Limit OTP guesses per client before Firebase authentication and transaction work.
const partnerOtpStartLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Too many OTP attempts. Please wait 15 minutes and try again.' } });

// Assigned partner verifies the customer-shared OTP; the transition is atomic and one-time.
app.post('/api/partners/bookings/:bookingId/start', partnerOtpStartLimiter, authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = String(req.params.bookingId || '');
    const code = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(bookingId) || !isValidStartOtp(code)) return res.status(400).json({ success: false, error: 'Enter a valid booking ID and the 6-digit customer OTP.' });
    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(bookingId);
    const otpRef = db.collection('booking_start_otps').doc(bookingId);
    const auditRef = db.collection('partner_job_audit_logs').doc();
    await db.runTransaction(async transaction => {
      const [bookingSnap, otpSnap] = await Promise.all([transaction.get(bookingRef), transaction.get(otpRef)]);
      if (!bookingSnap.exists || !otpSnap.exists) throw new Error('OTP_NOT_FOUND');
      const booking = bookingSnap.data()!;
      const otp = otpSnap.data()!;
      if (booking.technicianUid !== identity.uid || otp.partnerUid !== identity.uid) throw new Error('NOT_ASSIGNED_PARTNER');
      if (!['assigned', 'technician_en_route'].includes(String(booking.status || ''))) throw new Error('INVALID_BOOKING_STATE');
      if (isStartOtpExpired(otp.expiresAt)) throw new Error('OTP_EXPIRED');
      if (otp.code !== code) throw new Error('OTP_INVALID');
      transaction.update(bookingRef, { status: 'in_progress', serviceStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.delete(otpRef);
      transaction.create(auditRef, { action: 'service_started', bookingId, partnerUid: identity.uid, createdAt: FieldValue.serverTimestamp() });
    });
    return res.json({ success: true, bookingId, status: 'in_progress' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'OTP_NOT_FOUND') return res.status(404).json({ success: false, error: 'Service-start code was not found.' });
    if (code === 'NOT_ASSIGNED_PARTNER') return res.status(403).json({ success: false, error: 'Only the assigned Channel Partner can start this job.' });
    if (code === 'INVALID_BOOKING_STATE') return res.status(409).json({ success: false, error: 'This booking is not waiting to start.' });
    if (code === 'OTP_EXPIRED') return res.status(410).json({ success: false, error: 'The service-start code has expired.' });
    if (code === 'OTP_INVALID') return res.status(400).json({ success: false, error: 'The customer OTP is incorrect.' });
    console.error('Partner service-start verification failed:', error);
    return res.status(500).json({ success: false, error: 'The service could not be started securely.' });
  }
});

// Assigned partner marks a started job complete; payment and wallet settlement remain separate.
app.post('/api/partners/bookings/:bookingId/complete', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = String(req.params.bookingId || '');
    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(bookingId);
    const auditRef = db.collection('partner_job_audit_logs').doc();
    await db.runTransaction(async transaction => {
      const bookingSnap = await transaction.get(bookingRef);
      if (!bookingSnap.exists) throw new Error('BOOKING_NOT_FOUND');
      const booking = bookingSnap.data()!;
      if (booking.technicianUid !== identity.uid) throw new Error('NOT_ASSIGNED_PARTNER');
      if (booking.status !== 'in_progress') throw new Error('INVALID_BOOKING_STATE');
      transaction.update(bookingRef, { status: 'completed', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, { action: 'service_completed', bookingId, partnerUid: identity.uid, createdAt: FieldValue.serverTimestamp() });
    });
    return res.json({ success: true, bookingId, status: 'completed', message: 'Service completion recorded. Payment settlement is not implied.' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'BOOKING_NOT_FOUND') return res.status(404).json({ success: false, error: 'Booking was not found.' });
    if (code === 'NOT_ASSIGNED_PARTNER') return res.status(403).json({ success: false, error: 'Only the assigned Channel Partner can complete this job.' });
    if (code === 'INVALID_BOOKING_STATE') return res.status(409).json({ success: false, error: 'Only an in-progress job can be completed.' });
    console.error('Partner service completion failed:', error);
    return res.status(500).json({ success: false, error: 'Service completion could not be recorded securely.' });
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
app.post('/api/places/grounding', authenticateFirebaseUser, async (req: Request, res: Response) => {
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


const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024;
const KYC_DOCUMENT_TYPES = new Set(['identity_proof', 'address_proof', 'qualification_certificate', 'profile_photo']);
const KYC_ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function getKycStorageBucket() {
  if (!firebaseAdminApp) return null;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim() || firebaseAdminApp.options.storageBucket;
  return bucketName ? getStorage(firebaseAdminApp).bucket(bucketName) : null;
}

// Return the server-owned KYC policy contract to the signed-in partner UI.
// The browser never chooses the privacy notice version or retention period.
app.get('/api/partners/kyc-config', authenticateFirebaseUser, (_req: Request, res: Response) => {
  const noticeVersion = process.env.KYC_PRIVACY_NOTICE_VERSION?.trim();
  const retentionDays = Number(process.env.KYC_RETENTION_DAYS);
  if (!noticeVersion || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650 || !getKycStorageBucket()) {
    return res.status(503).json({ success: false, error: 'Secure KYC document submission is not configured.' });
  }
  return res.json({
    success: true,
    privacyNoticeVersion: noticeVersion,
    retentionDays,
    maxFileBytes: KYC_MAX_FILE_BYTES,
    allowedContentTypes: Array.from(KYC_ALLOWED_CONTENT_TYPES),
    documentTypes: Array.from(KYC_DOCUMENT_TYPES)
  });
});

app.post('/api/partners/kyc-submissions', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure KYC service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const noticeVersion = process.env.KYC_PRIVACY_NOTICE_VERSION?.trim();
    const retentionDays = Number(process.env.KYC_RETENTION_DAYS);
    if (!noticeVersion || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      return res.status(503).json({ success: false, error: 'KYC privacy notice and retention policy are not configured. Document submission is disabled.' });
    }
    const { submissionId, documentType, objectPath, privacyNoticeVersion, consentAccepted, retentionNoticeAccepted } = req.body ?? {};
    const validId = typeof submissionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId);
    const validType = typeof documentType === 'string' && KYC_DOCUMENT_TYPES.has(documentType);
    const extension = typeof objectPath === 'string' ? objectPath.split('.').pop()?.toLowerCase() : '';
    const validExtension = ['jpg', 'jpeg', 'png', 'pdf'].includes(extension || '');
    const expectedPath = validId && validType && validExtension ? `partner-kyc/${identity.uid}/${submissionId}_${documentType}.${extension}` : '';
    if (!validId || !validType || !validExtension || objectPath !== expectedPath ||
        privacyNoticeVersion !== noticeVersion || consentAccepted !== true || retentionNoticeAccepted !== true) {
      return res.status(400).json({ success: false, error: 'KYC submission details, privacy notice version, or consent are invalid.' });
    }
    const bucket = getKycStorageBucket();
    if (!bucket) return res.status(503).json({ success: false, error: 'Private KYC Storage bucket is not configured.' });
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return res.status(400).json({ success: false, error: 'The private KYC document was not found. Upload it before submitting.' });
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (!Number.isFinite(size) || size <= 0 || size > KYC_MAX_FILE_BYTES ||
        !metadata.contentType || !KYC_ALLOWED_CONTENT_TYPES.has(metadata.contentType) ||
        !metadata.generation || !metadata.timeCreated) {
      return res.status(400).json({ success: false, error: 'The uploaded document type, size, or object metadata is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(identity.uid);
    const submissionRef = db.collection('partner_kyc_submissions').doc(submissionId);
    const auditRef = db.collection('partner_kyc_audit').doc(randomUUID());
    await db.runTransaction(async (transaction) => {
      const [partner, existing] = await Promise.all([transaction.get(partnerRef), transaction.get(submissionRef)]);
      if (!partner.exists || partner.data()?.role !== 'CHANNEL_PARTNER') throw new Error('PARTNER_PROFILE_REQUIRED');
      if (existing.exists) throw new Error('KYC_SUBMISSION_ALREADY_EXISTS');
      if (partner.data()?.kycStatus === 'approved') throw new Error('KYC_ALREADY_APPROVED');
      transaction.create(submissionRef, {
        submissionId, partnerUid: identity.uid, documentType, objectPath,
        objectGeneration: String(metadata.generation), contentType: metadata.contentType, sizeBytes: size,
        status: 'pending_review', documentExpiryStatus: 'pending_expiry', privacyNoticeVersion: noticeVersion,
        consentAcceptedAt: FieldValue.serverTimestamp(),
        retentionExpiresAt: new Date(Date.now() + retentionDays * 86400000),
        submittedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: null
      });
      transaction.update(partnerRef, { kycStatus: 'submitted', updatedAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, {
        event: 'document_submitted', submissionId, partnerUid: identity.uid,
        actorUid: identity.uid, createdAt: FieldValue.serverTimestamp()
      });
    });
    return res.status(201).json({ success: true, submissionId, status: 'pending_review', message: 'Document received securely and queued for review.' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PARTNER_PROFILE_REQUIRED') return res.status(403).json({ success: false, error: 'A Channel Partner profile is required to submit KYC.' });
    if (code === 'KYC_SUBMISSION_ALREADY_EXISTS') return res.status(409).json({ success: false, error: 'This KYC submission already exists.' });
    if (code === 'KYC_ALREADY_APPROVED') return res.status(409).json({ success: false, error: 'KYC is already approved for this partner.' });
    console.error('Partner KYC submission failed:', error);
    return res.status(500).json({ success: false, error: 'KYC document submission could not be completed securely.' });
  }
});

app.get('/api/partners/kyc-status', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure KYC service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const snapshot = await getFirestore(firebaseAdminApp).collection('partner_kyc_submissions').where('partnerUid', '==', uid).limit(20).get();
    const submissions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { submissionId: doc.id, documentType: data.documentType, status: data.status,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? null,
        reviewedAt: data.reviewedAt?.toDate?.()?.toISOString?.() ?? null,
        reviewReason: data.partnerVisibleReason ?? null };
    });
    return res.json({ success: true, submissions });
  } catch (error) {
    console.error('Partner KYC status lookup failed:', error);
    return res.status(500).json({ success: false, error: 'KYC status could not be loaded.' });
  }
});

app.get('/api/admin/kyc-submissions', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure KYC admin service is unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('partner_kyc_submissions').where('status', '==', 'pending_review').limit(50).get();
    const submissions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { submissionId: doc.id, partnerUid: data.partnerUid, documentType: data.documentType,
        objectPath: data.objectPath, contentType: data.contentType, sizeBytes: data.sizeBytes,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? null };
    });
    return res.json({ success: true, submissions });
  } catch (error) {
    console.error('Admin KYC queue lookup failed:', error);
    return res.status(500).json({ success: false, error: 'KYC review queue could not be loaded.' });
  }
});

app.get('/api/admin/kyc-submissions/:submissionId/document-url', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure KYC admin service is unavailable.' });
    const id = req.params.submissionId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, error: 'KYC submission ID is invalid.' });
    const submission = await getFirestore(firebaseAdminApp).collection('partner_kyc_submissions').doc(id).get();
    if (!submission.exists) return res.status(404).json({ success: false, error: 'KYC submission was not found.' });
    const submissionData = submission.data()!;
    const objectPath = submissionData.objectPath;
    const partnerUid = submissionData.partnerUid;
    const expectedObjectPrefix = typeof partnerUid === 'string' && partnerUid.length > 0
      ? `partner-kyc/${partnerUid}/${id}_`
      : '';
    if (!expectedObjectPrefix || typeof objectPath !== 'string' ||
        !objectPath.startsWith(expectedObjectPrefix) ||
        !/^[0-9a-f-]{36}_(identity_proof|address_proof|qualification_certificate|profile_photo)\\.(jpg|jpeg|png|pdf)$/i.test(objectPath.slice(`partner-kyc/${partnerUid}/`.length)) ||
        typeof submissionData.objectGeneration !== 'string' || !/^\\d+$/.test(submissionData.objectGeneration)) {
      return res.status(409).json({ success: false, error: 'KYC document reference is invalid.' });
    }
    const bucket = getKycStorageBucket();
    if (!bucket) return res.status(503).json({ success: false, error: 'Private KYC Storage bucket is not configured.' });
    const [url] = await bucket.file(objectPath, { generation: submissionData.objectGeneration }).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000, version: 'v4' });
    return res.json({ success: true, url, expiresInSeconds: 300 });
  } catch (error) {
    console.error('Admin KYC document access failed:', error);
    return res.status(500).json({ success: false, error: 'A temporary KYC document link could not be created.' });
  }
});

app.post('/api/admin/kyc-submissions/:submissionId/decision', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure KYC admin service is unavailable.' });
    const id = req.params.submissionId;
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { decision, reason } = req.body ?? {};
    const validDecision = ['approved', 'rejected', 'needs_resubmission'].includes(decision);
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
        !validDecision || cleanReason.length > 500 || (decision !== 'approved' && cleanReason.length < 5)) {
      return res.status(400).json({ success: false, error: 'Review decision or reason is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const submissionRef = db.collection('partner_kyc_submissions').doc(id);
    const auditRef = db.collection('partner_kyc_audit').doc(randomUUID());
    await db.runTransaction(async (transaction) => {
      const submission = await transaction.get(submissionRef);
      if (!submission.exists) throw new Error('KYC_SUBMISSION_NOT_FOUND');
      const data = submission.data()!;
      if (data.status !== 'pending_review') throw new Error('KYC_SUBMISSION_ALREADY_REVIEWED');
      const partnerRef = db.collection('users').doc(data.partnerUid);
      const partner = await transaction.get(partnerRef);
      if (!partner.exists || partner.data()?.role !== 'CHANNEL_PARTNER') throw new Error('PARTNER_PROFILE_REQUIRED');
      const nextStatus = decision === 'approved' ? 'approved' : decision;
      transaction.update(submissionRef, { status: nextStatus, reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: identity.uid, ...(cleanReason ? { partnerVisibleReason: cleanReason } : {}) });
      transaction.update(partnerRef, { kycStatus: nextStatus, isVerified: false, updatedAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, { event: 'review_decision', submissionId: id, partnerUid: data.partnerUid,
        actorUid: identity.uid, decision: nextStatus, reason: cleanReason || null, createdAt: FieldValue.serverTimestamp() });
    });
    return res.json({ success: true, submissionId: id, decision, partnerActivated: false });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'KYC_SUBMISSION_NOT_FOUND') return res.status(404).json({ success: false, error: 'KYC submission was not found.' });
    if (code === 'KYC_SUBMISSION_ALREADY_REVIEWED') return res.status(409).json({ success: false, error: 'This KYC submission has already been reviewed.' });
    if (code === 'PARTNER_PROFILE_REQUIRED') return res.status(409).json({ success: false, error: 'The Channel Partner profile is unavailable.' });
    console.error('Admin KYC review decision failed:', error);
    return res.status(500).json({ success: false, error: 'KYC review decision could not be saved securely.' });
  }
});

// Admin-only directory for all registered Channel Partners and legacy Technicians.
app.get('/api/admin/partners', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('users')
      .where('role', 'in', ['CHANNEL_PARTNER', 'TECHNICIAN'])
      .limit(200)
      .get();
    const partners = snapshot.docs.map((doc) => {
      const data = doc.data();
      const dispatchEligible = isPartnerEligibleForDispatch(data);
      const dispatchLocation = data.dispatchLocation;
      const dispatchLocationConfigured = Boolean(dispatchLocation &&
        typeof dispatchLocation.latitude === 'number' &&
        typeof dispatchLocation.longitude === 'number');
      const dispatchRadiusValid = [1, 3, 5, 10, 15].includes(data.dispatchRadiusKm);
      return {
        uid: doc.id,
        displayName: String(data.displayName || ''),
        phoneNumber: String(data.phoneNumber || ''),
        email: String(data.email || ''),
        role: String(data.role || ''),
        city: String(data.city || ''),
        serviceArea: {
          state: String(data.serviceArea?.state || ''),
          district: String(data.serviceArea?.district || ''),
          tehsil: String(data.serviceArea?.tehsil || '')
        },
        trades: Array.isArray(data.trades) ? data.trades.filter((trade: unknown) => typeof trade === 'string').slice(0, 30) : [],
        approvalStatus: String(data.approvalStatus || 'unknown'),
        kycStatus: String(data.kycStatus || 'not_submitted'),
        isVerified: data.isVerified === true,
        isOnline: data.isOnline === true,
        isSuspended: data.isSuspended === true,
        securityDepositPaid: data.securityDepositPaid === true,
        walletBalance: typeof data.walletBalance === 'number' && Number.isFinite(data.walletBalance) ? data.walletBalance : null,
        dispatchEligible,
        dispatchReady: dispatchEligible && dispatchLocationConfigured && dispatchRadiusValid,
        dispatchRadiusKm: typeof data.dispatchRadiusKm === 'number' ? data.dispatchRadiusKm : null,
        dispatchLocationConfigured,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null
      };
    }).sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
    return res.json({ success: true, partners, limit: 200 });
  } catch (error) {
    console.error('Admin Channel Partner directory lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Channel Partner directory could not be loaded.' });
  }
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
        kycStatus: data.kycStatus || 'not_submitted',
        dispatchRadiusKm: typeof data.dispatchRadiusKm === 'number' ? data.dispatchRadiusKm : null,
        dispatchLocationConfigured: Boolean(data.dispatchLocation &&
          typeof data.dispatchLocation.latitude === 'number' &&
          typeof data.dispatchLocation.longitude === 'number')
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

// Scheduled KYC document expiry. This deletes only the exact uploaded file generation;
// partner/customer profiles, verification decisions, bookings and audit history remain.
app.post('/api/internal/kyc-document-expiry', async (req: Request, res: Response) => {
  const configuredToken = process.env.KYC_EXPIRY_JOB_TOKEN || '';
  const suppliedToken = req.header('authorization')?.replace(/^Bearer\\s+/i, '') || '';
  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  if (!configuredToken || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ success: false, error: 'Unauthorized scheduled job.' });
  }
  if (!firebaseAdminApp || !getKycStorageBucket()) {
    return res.status(503).json({ success: false, error: 'KYC Storage is not configured.' });
  }

  const db = getFirestore(firebaseAdminApp);
  const bucket = getKycStorageBucket()!;
  const now = new Date();
  let deleted = 0;
  let alreadyProcessed = 0;
  let skipped = 0;
  try {
    const expired = await db.collection('partner_kyc_submissions')
      .where('documentExpiryStatus', '==', 'pending_expiry')
      .where('retentionExpiresAt', '<=', now)
      .limit(100)
      .get();

    for (const snapshot of expired.docs) {
      const data = snapshot.data();
      if (data.documentDeletedAt || data.documentExpiryStatus !== 'pending_expiry') {
        alreadyProcessed++;
        continue;
      }
      const partnerUid = typeof data.partnerUid === 'string' ? data.partnerUid : '';
      const submissionId = typeof data.submissionId === 'string' ? data.submissionId : '';
      const documentType = typeof data.documentType === 'string' ? data.documentType : '';
      const objectPath = typeof data.objectPath === 'string' ? data.objectPath : '';
      const generation = typeof data.objectGeneration === 'string' ? data.objectGeneration : '';
      const extension = objectPath.split('.').pop()?.toLowerCase() || '';
      const valid = /^[A-Za-z0-9_-]{1,128}$/.test(partnerUid) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId) &&
        ['identity_proof', 'address_proof', 'qualification_certificate', 'profile_photo'].includes(documentType) &&
        ['jpg', 'jpeg', 'png', 'pdf'].includes(extension) &&
        objectPath === `partner-kyc/${partnerUid}/${submissionId}_${documentType}.${extension}` &&
        /^\\d+$/.test(generation);
      if (!valid) {
        skipped++;
        console.error('KYC expiry skipped malformed submission metadata:', snapshot.id);
        continue;
      }

      try {
        await bucket.file(objectPath, { generation }).delete({ ignoreNotFound: true });
      } catch (deleteError) {
        console.error('KYC document deletion failed:', snapshot.id, deleteError);
        skipped++;
        continue;
      }

      const auditRef = db.collection('partner_kyc_audit').doc(randomUUID());
      const marked = await db.runTransaction(async (transaction) => {
        const current = await transaction.get(snapshot.ref);
        if (!current.exists || current.data()?.documentDeletedAt) return false;
        transaction.update(snapshot.ref, {
          documentDeletedAt: FieldValue.serverTimestamp(),
          documentExpiryStatus: 'deleted_after_retention',
          documentDeletionReason: '180_day_retention_expired',
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.create(auditRef, {
          event: 'document_expired_and_deleted',
          submissionId,
          partnerUid,
          actor: 'scheduled_retention_job',
          createdAt: FieldValue.serverTimestamp()
        });
        return true;
      });
      if (marked) deleted++;
      else alreadyProcessed++;
    }

    return res.json({
      success: true,
      scanned: expired.size,
      deleted,
      alreadyProcessed,
      skipped,
      note: 'Only expired KYC file objects are deleted; account profiles, verification decisions, bookings and audit records are retained.'
    });
  } catch (error) {
    console.error('KYC document expiry job failed:', error);
    return res.status(500).json({ success: false, error: 'KYC expiry job failed.' });
  }
});

// Admin bank destination: account number is encrypted at rest with a dedicated 32-byte key.
// This endpoint stores settlement details only; it does not activate payment collection or payouts.
app.get('/api/admin/payment-bank', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('system').doc('admin_payment_bank').get();
    if (!snapshot.exists) return res.json({ success: true, configured: false });
    const data = snapshot.data()!;
    return res.json({ success: true, configured: true, bankName: data.bankName, accountLast4: data.accountLast4, ifsc: data.ifsc, accountHolderName: data.accountHolderName, updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null });
  } catch (error) {
    console.error('Admin bank details lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Bank details could not be loaded securely.' });
  }
});

app.put('/api/admin/payment-bank', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const keyText = process.env.ADMIN_BANK_ENCRYPTION_KEY || '';
    let key: Buffer;
    try { key = Buffer.from(keyText, 'base64'); } catch { key = Buffer.alloc(0); }
    if (key.length !== 32) return res.status(503).json({ success: false, error: 'Bank encryption is not configured on the server. No bank details were saved.' });
    const { bankName, accountHolderName, accountNumber, ifsc } = req.body ?? {};
    const cleanBank = typeof bankName === 'string' ? bankName.trim() : '';
    const cleanHolder = typeof accountHolderName === 'string' ? accountHolderName.trim() : '';
    const cleanAccount = typeof accountNumber === 'string' ? accountNumber.replace(/\\s/g, '') : '';
    const cleanIfsc = typeof ifsc === 'string' ? ifsc.trim().toUpperCase() : '';
    if (!cleanBank || cleanBank.length > 100 || cleanHolder.length < 2 || cleanHolder.length > 100 ||
        !/^\\d{9,18}$/.test(cleanAccount) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      return res.status(400).json({ success: false, error: 'Enter a valid bank, account holder name, 9–18 digit account number and IFSC.' });
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(cleanAccount, 'utf8'), cipher.final()]);
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    await getFirestore(firebaseAdminApp).collection('system').doc('admin_payment_bank').set({
      bankName: cleanBank, accountHolderName: cleanHolder, ifsc: cleanIfsc,
      accountCiphertext: encrypted.toString('base64'), accountIv: iv.toString('base64'),
      accountAuthTag: cipher.getAuthTag().toString('base64'), accountLast4: cleanAccount.slice(-4),
      encryption: 'AES-256-GCM', updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, configured: true, bankName: cleanBank, accountLast4: cleanAccount.slice(-4), ifsc: cleanIfsc, accountHolderName: cleanHolder });
  } catch (error) {
    console.error('Admin bank details save failed:', error);
    return res.status(500).json({ success: false, error: 'Bank details could not be saved securely.' });
  }
});

// Server-side admin gate. No client-supplied role or email is trusted.
app.get('/api/admin/health', authenticateFirebaseUser, requireServerAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, authenticated: true, authorization: 'server_verified_admin_claim' });
});

// Lightweight public liveness endpoint: confirms the web process can answer HTTP requests.
// Liveness: the HTTP process is running. Dependency readiness is reported separately.
app.get('/healthz', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    service: 'QuickFix-India',
    status: 'ok',
    firebase_admin_init: Boolean(firebaseAdminApp)
  });
});

let firestoreStartupProbePassed = false;

// Readiness: protected APIs require Firebase Admin and a successful Firestore startup probe.
app.get('/readyz', (_req: Request, res: Response) => {
  const ready = Boolean(firebaseAdminApp) && firestoreStartupProbePassed;
  return res.status(ready ? 200 : 503).json({
    success: ready,
    service: 'QuickFix-India',
    status: ready ? 'ready' : 'not_ready',
    firebase_admin_init: Boolean(firebaseAdminApp),
    firestore_startup_probe: firestoreStartupProbePassed ? 'passed' : 'not_passed'
  });
});

async function runFirestoreStartupProbe() {
  if (!firebaseAdminApp) {
    console.error('Firestore startup probe skipped: Firebase Admin is not initialized.');
    return;
  }

  const db = getFirestore(firebaseAdminApp);
  const probeId = `render_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const probeRef = db.collection('_quickfix_health').doc(probeId);
  let writeSucceeded = false;
  try {
    await probeRef.set({ probe: true, createdAt: FieldValue.serverTimestamp() });
    writeSucceeded = true;
    const snapshot = await probeRef.get();
    if (!snapshot.exists || snapshot.data()?.probe !== true) {
      throw new Error('Firestore probe read did not return the written marker.');
    }
    firestoreStartupProbePassed = true;
    console.info('Firestore startup probe passed: temporary document write and read succeeded.');
  } catch (error) {
    firestoreStartupProbePassed = false;
    console.error('Firestore startup probe failed:', error);
  } finally {
    if (writeSucceeded) {
      try {
        await probeRef.delete();
        console.info('Firestore startup probe cleanup succeeded.');
      } catch (cleanupError) {
        console.error('Firestore startup probe cleanup failed; inspect the temporary _quickfix_health document:', cleanupError);
      }
    }
  }
}

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
    void runFirestoreStartupProbe();
  });
}

startServer();
