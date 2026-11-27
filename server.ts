import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { extractBearerToken } from './src/lib/serverAuth.ts';
import { areBothLocationConsentsEnabled, getBookingLocationParticipantRole, isLiveLocationBookingStatus } from './src/utils/liveLocation';
import { getFirestore, FieldValue, FieldPath, type Firestore, type QueryDocumentSnapshot, type DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { INITIAL_SERVICES, INITIAL_COMMISSION_SETTINGS } from './src/data/mockData';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { randomInt, randomUUID, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from 'node:crypto';
import { fileURLToPath } from 'url';
import { isValidBookingDate } from './src/utils/bookingDate';
import { canActivatePartnerDuty, canPartnerReceiveBookingCategories, canPartnerReceiveBookingCategory, isPartnerEligibleForDispatch } from './src/utils/partnerEligibility';
import { validatePartnerRechargePolicy } from './src/utils/partnerRechargePolicy';
import { isConflictingPaidPayment } from './src/utils/paymentVerificationPolicy';
import { calculateRateQuote, resolveLocationRateCard, type LocationRateCard } from './src/data/rateCards';
import { getBillingProfile, type BillingUnit } from './src/data/pricing';
import { isWithinPartnerDispatchRadius } from './src/utils/geo';
import { hasDistrictServiceArea, matchesPartnerServiceArea, serviceAreaKey } from './src/utils/serviceArea';
import { getSosReporterRole, isActiveSosBookingStatus, isValidSosIncidentInput } from './src/utils/sosIncident';
import { EMERGENCY_CONTACT_LIMIT, EMERGENCY_CONTACT_OTP_MAX_ATTEMPTS, EMERGENCY_CONTACT_OTP_PER_ACCOUNT_PER_HOUR, EMERGENCY_CONTACT_OTP_PER_PHONE_PER_HOUR, EMERGENCY_CONTACT_OTP_RESEND_MS, EMERGENCY_CONTACT_OTP_TTL_MS, emergencyContactDocId, hashEmergencyContactOtp, isValidEmergencyPhone, maskEmergencyPhone, normalizeEmergencyPhone, verifyEmergencyContactOtpHash } from './src/utils/emergencyContacts';
import { isStartOtpBookingStatus, isStartOtpExpired, isValidStartOtp } from './src/utils/bookingOtp';
import { normalizeQuickFixId } from './src/utils/quickFixId';

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

const hasChannelPartnerRole = (profile: unknown): boolean => {
  if (!profile || typeof profile !== 'object') return false;
  const data = profile as { role?: unknown; roles?: unknown };
  const roles = Array.isArray(data.roles) ? data.roles : [data.role];
  return roles.some((role: unknown) => typeof role === 'string' &&
    ['CHANNEL_PARTNER', 'TECHNICIAN'].includes(role.toUpperCase()));
};

const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.QUICKFIX_INTEGRATION_TEST === 'true',
  message: { success: false, error: 'Too many requests. Please try again in one minute.' },
});

const authenticateFirebaseUser = async (req: Request, res: Response, next: NextFunction) => {
  if (!firebaseAdminApp) {
    return res.status(503).json({ success: false, error: 'Secure authentication is temporarily unavailable.' });
  }
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ success: false, error: 'A valid Firebase ID token is required.' });
  }
  try {
    (req as AuthenticatedRequest).firebaseUser = await getAuth(firebaseAdminApp).verifyIdToken(token, true);
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

const requireCustomerCareAccess = (req: Request, res: Response, next: NextFunction) => {
  const claims = (req as AuthenticatedRequest).firebaseUser;
  if (claims?.admin === true || claims?.customerCare === true) return next();
  return res.status(403).json({ success: false, error: 'Authorized Customer Care access is required.' });
};

const createQuickFixId = (kind: 'CUSTOMER' | 'PARTNER') => 'QF' + (kind === 'CUSTOMER' ? 'C' : 'P') + '-' + randomInt(10000000, 100000000);


// Apply the API rate limit before registering any API route, including booking creation.
app.use('/api', apiRateLimit);

const notificationTokenId = (token: string) => createHash('sha256').update(token).digest('hex');

type PartnerBookingPushResult = {
  status: 'sent' | 'no_eligible_partners' | 'no_registered_devices' | 'failed';
  eligiblePartners: number;
  devices: number;
};

const notifyEligiblePartnersOfBooking = async (
  db: Firestore,
  booking: Record<string, any>
): Promise<PartnerBookingPushResult> => {
  try {
    if (!firebaseAdminApp) return { status: 'failed', eligiblePartners: 0, devices: 0 };
    const [primaryRoleProfiles, multiRoleProfiles] = await Promise.all([
      db.collection('users').where('role', 'in', ['CHANNEL_PARTNER', 'TECHNICIAN']).limit(500).get(),
      db.collection('users').where('roles', 'array-contains', 'CHANNEL_PARTNER').limit(500).get()
    ]);
    const profiles = new Map<string, QueryDocumentSnapshot>();
    [...primaryRoleProfiles.docs, ...multiRoleProfiles.docs].forEach(document => profiles.set(document.id, document));
    const eligible = [...profiles.values()].filter(document => {
      const profile = document.data();
      const trades = Array.isArray(profile.trades)
        ? profile.trades.filter((trade: unknown): trade is string => typeof trade === 'string')
        : [];
      const partnerArea = profile.serviceArea && typeof profile.serviceArea === 'object'
        ? profile.serviceArea as Record<string, unknown> : null;
      const bookingArea = booking.serviceArea && typeof booking.serviceArea === 'object'
        ? booking.serviceArea as Record<string, unknown> : null;
      const city = typeof profile.city === 'string' ? profile.city.trim() : '';
      return isPartnerEligibleForDispatch(profile) &&
        canPartnerReceiveBookingCategories(trades, Array.isArray(booking.lineItems) && booking.lineItems.length
          ? booking.lineItems.map((line: any) => line?.category)
          : [booking.category]) &&
        matchesPartnerServiceArea(partnerArea, bookingArea, city, booking.city) &&
        isWithinPartnerDispatchRadius(profile, booking);
    });
    if (eligible.length === 0) return { status: 'no_eligible_partners', eligiblePartners: 0, devices: 0 };

    const tokenGroups = await Promise.all(eligible.map(async partner => {
      const snapshot = await partner.ref.collection('notificationTokens').limit(10).get();
      return snapshot.docs.map(document => ({
        uid: partner.id,
        token: String(document.data().token || ''),
        ref: document.ref
      })).filter(item => item.token.length >= 80 && item.token.length <= 4096);
    }));
    const tokenEntries = tokenGroups.flat();
    if (tokenEntries.length === 0) {
      return { status: 'no_registered_devices', eligiblePartners: eligible.length, devices: 0 };
    }

    let sent = 0;
    for (let offset = 0; offset < tokenEntries.length; offset += 500) {
      const chunk = tokenEntries.slice(offset, offset + 500);
      const result = await getMessaging(firebaseAdminApp).sendEachForMulticast({
        tokens: chunk.map(item => item.token),
        notification: {
          title: 'New QuickFix service request',
          body: String(booking.serviceTitle || 'A nearby service request') + ' · ' +
            String(booking.serviceArea?.district || booking.city || 'Your service area')
        },
        data: {
          type: 'NEW_BOOKING',
          bookingId: String(booking.id || ''),
          category: String(booking.category || '')
        },
        android: {
          priority: 'high',
          notification: { channelId: 'quickfix_job_alerts' }
        }
      });
      sent += result.successCount;
      const staleEntries = result.responses.flatMap((response, index) => {
        const code = response.error?.code || '';
        return !response.success &&
          (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token'))
          ? [chunk[index]] : [];
      });
      if (staleEntries.length) {
        await Promise.all(staleEntries.map(async entry => {
          await entry.ref.delete().catch(() => undefined);
          const ownerRef = db.collection('fcm_token_owners').doc(notificationTokenId(entry.token));
          await db.runTransaction(async transaction => {
            const owner = await transaction.get(ownerRef);
            if (owner.exists && owner.data()?.uid === entry.uid) transaction.delete(ownerRef);
          }).catch(() => undefined);
        }));
      }
    }
    return {
      status: sent > 0 ? 'sent' : 'failed',
      eligiblePartners: eligible.length,
      devices: tokenEntries.length
    };
  } catch (error) {
    console.error('QuickFix partner booking push notification failed:', error instanceof Error ? error.name : 'unknown error');
    return { status: 'failed', eligiblePartners: 0, devices: 0 };
  }
};

// Register an Android FCM token only for a signed-in Channel Partner.
app.post('/api/partners/notifications/token', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Notification registration is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (token.length < 80 || token.length > 4096 || /[\x00-\x1F\x7F]/.test(token)) {
      return res.status(400).json({ success: false, error: 'Device notification token is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const profile = await db.collection('users').doc(identity.uid).get();
    if (!profile.exists || !hasChannelPartnerRole(profile.data())) {
      return res.status(403).json({ success: false, error: 'A registered Channel Partner account is required.' });
    }
    const tokenId = notificationTokenId(token);
    const tokenRef = db.collection('users').doc(identity.uid).collection('notificationTokens').doc(tokenId);
    const ownerRef = db.collection('fcm_token_owners').doc(tokenId);
    await db.runTransaction(async transaction => {
      const owner = await transaction.get(ownerRef);
      const previousUid = owner.exists ? String(owner.data()?.uid || '') : '';
      if (previousUid && previousUid !== identity.uid) {
        transaction.delete(db.collection('users').doc(previousUid).collection('notificationTokens').doc(tokenId));
      }
      transaction.set(tokenRef, { token, platform: 'android', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(ownerRef, { uid: identity.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return res.json({ success: true, registered: true });
  } catch (error) {
    console.error('Partner notification token registration failed:', error);
    return res.status(500).json({ success: false, error: 'Device notifications could not be enabled.' });
  }
});


// Remove a device token before sign-out so a shared phone does not keep receiving
// another account's partner job alerts.
app.delete('/api/partners/notifications/token', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Notification registration is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (token.length < 80 || token.length > 4096) {
      return res.status(400).json({ success: false, error: 'Device notification token is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const tokenId = notificationTokenId(token);
    const ownerRef = db.collection('fcm_token_owners').doc(tokenId);
    const tokenRef = db.collection('users').doc(identity.uid).collection('notificationTokens').doc(tokenId);
    const removed = await db.runTransaction(async transaction => {
      const owner = await transaction.get(ownerRef);
      const ownerUid = owner.exists ? String(owner.data()?.uid || '') : '';
      if (ownerUid && ownerUid !== identity.uid) return false;
      transaction.delete(tokenRef);
      if (ownerUid === identity.uid) transaction.delete(ownerRef);
      return true;
    });
    return res.json({ success: true, removed });
  } catch (error) {
    console.error('Partner notification token removal failed:', error);
    return res.status(500).json({ success: false, error: 'Device notifications could not be disabled.' });
  }
});

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

// Customer identity registration. The permanent QuickFix ID is issued only by the server.
app.post('/api/customers/register', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure customer registration is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    if (!identity.phone_number) return res.status(403).json({ success: false, error: 'A verified mobile number is required.' });
    const { displayName, email, address, city } = req.body ?? {};
    if (typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 100 ||
        typeof email !== 'string' || email.trim().length > 254 ||
        (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) ||
        (address !== undefined && (typeof address !== 'string' || address.trim().length > 500)) ||
        (city !== undefined && (typeof city !== 'string' || city.trim().length > 100))) {
      return res.status(400).json({ success: false, error: 'Customer profile details are invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    let issuedId = '';
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(userRef);
      const data = existing.exists ? existing.data()! : undefined;
      if (data) {
        const roles = Array.isArray(data.roles) ? data.roles : [data.role];
        if (!roles.includes('CUSTOMER') || data.phoneNumber !== identity.phone_number) throw new Error('CUSTOMER_PROFILE_CONFLICT');
      }

      const storedId = typeof data?.customerQuickFixId === 'string'
        ? data.customerQuickFixId.trim().toUpperCase()
        : '';
      const hasValidStoredId = /^QFC-\d{8}$/.test(storedId);
      if (hasValidStoredId) {
        const storedIndexRef = db.collection('quickfix_id_index').doc(storedId);
        const storedIndex = await transaction.get(storedIndexRef);
        if (storedIndex.exists && storedIndex.data()?.uid !== identity.uid) {
          throw new Error('CUSTOMER_ID_INDEX_CONFLICT');
        }
        issuedId = storedId;
        if (!storedIndex.exists) {
          transaction.create(storedIndexRef, {
            uid: identity.uid,
            accountType: 'CUSTOMER',
            createdAt: FieldValue.serverTimestamp(),
            repairedAt: FieldValue.serverTimestamp()
          });
        }
        if (data?.customerQuickFixId !== storedId || data?.quickFixId !== storedId) {
          transaction.update(userRef, { customerQuickFixId: storedId, quickFixId: storedId, updatedAt: FieldValue.serverTimestamp() });
        }
        return;
      }

      let candidate = '';
      let idRef: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        candidate = createQuickFixId('CUSTOMER');
        const candidateRef = db.collection('quickfix_id_index').doc(candidate);
        const collision = await transaction.get(candidateRef);
        if (!collision.exists) { idRef = candidateRef; break; }
        candidate = '';
      }
      if (!candidate || !idRef) throw new Error('QUICKFIX_ID_ALLOCATION_FAILED');
      issuedId = candidate;
      const profile = {
        uid: identity.uid, phoneNumber: identity.phone_number,
        displayName: displayName.trim(), email: email.trim().toLowerCase(),
        role: 'CUSTOMER', roles: ['CUSTOMER'], isVerified: false,
        quickFixId: candidate, customerQuickFixId: candidate, createdAt: data?.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(typeof address === 'string' && address.trim() ? { address: address.trim() } : {}),
        ...(typeof city === 'string' && city.trim() ? { city: city.trim() } : {})
      };
      if (existing.exists) transaction.update(userRef, profile);
      else transaction.create(userRef, profile);
      transaction.create(idRef, { uid: identity.uid, accountType: 'CUSTOMER', createdAt: FieldValue.serverTimestamp() });
    });
    return res.status(200).json({ success: true, quickFixId: issuedId });
  } catch (error) {
    if (error instanceof Error && error.message === 'CUSTOMER_PROFILE_CONFLICT') return res.status(409).json({ success: false, error: 'This account is not eligible for Customer registration.' });
    if (error instanceof Error && error.message === 'CUSTOMER_ID_INDEX_CONFLICT') return res.status(409).json({ success: false, error: 'This QuickFix ID is already linked to another account. Please contact support.' });
    console.error('Secure customer registration failed:', error);
    return res.status(500).json({ success: false, error: 'Customer ID could not be issued securely. Please retry.' });
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
    const allowedTrades = new Set(['electrician', 'plumber', 'technician', 'ac_repair', 'fridge_repair', 'ac_fridge', 'appliance_repair', 'welder', 'mechanic', 'driver', 'tourist_guide', 'contractor', 'bike_taxi', 'bike_rider', 'kaamkaaj_partner', 'house_cleaning', 'cook', 'laundry', 'maid', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting', 'car_wash', 'transport', 'labour']);

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
    let issuedPartnerQuickFixId = '';
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(userRef);
      const existingData = existing.exists ? existing.data()! : undefined;
      let issuedQuickFixId = normalizeQuickFixId(existingData?.partnerQuickFixId, 'PARTNER') || '';
      let quickFixIdRef: DocumentReference | null = null;
      let quickFixIdIndexExists = false;
      if (issuedQuickFixId) {
        quickFixIdRef = db.collection('quickfix_id_index').doc(issuedQuickFixId);
        const existingIndex = await transaction.get(quickFixIdRef);
        if (existingIndex.exists && existingIndex.data()?.uid !== identity.uid) {
          throw new Error('PARTNER_ID_INDEX_CONFLICT');
        }
        quickFixIdIndexExists = existingIndex.exists;
      } else {
        for (let attempt = 0; attempt < 8; attempt++) {
          const candidate = createQuickFixId('PARTNER');
          const candidateRef = db.collection('quickfix_id_index').doc(candidate);
          const collision = await transaction.get(candidateRef);
          if (!collision.exists) { issuedQuickFixId = candidate; quickFixIdRef = candidateRef; break; }
        }
        if (!issuedQuickFixId || !quickFixIdRef) throw new Error('QUICKFIX_ID_ALLOCATION_FAILED');
      }
      issuedPartnerQuickFixId = issuedQuickFixId;
      if (existingData) {
        const existingRoles = Array.isArray(existingData.roles) ? existingData.roles : [existingData.role];
        const eligibleCustomer = existingData.role === 'CUSTOMER' &&
          existingData.isVerified === false &&
          existingData.phoneNumber === verifiedPhone &&
          existingRoles.includes('CUSTOMER') &&
          !existingRoles.includes('CHANNEL_PARTNER');
        if (!eligibleCustomer) throw new Error('PROFILE_ALREADY_EXISTS');
      }
      const partnerFields = {
        uid: identity.uid,
        phoneNumber: verifiedPhone,
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        role: 'CHANNEL_PARTNER',
        roles: ['CUSTOMER', 'CHANNEL_PARTNER'],
        partnerQuickFixId: issuedQuickFixId,
        quickFixId: issuedQuickFixId,
        subscriptionStatus: trialDays > 0 ? 'trial' : 'expired',
        subscriptionTrialDaysGranted: trialDays,
        ...(existingData?.subscriptionTrialStartedAt ? {} : { subscriptionTrialStartedAt: FieldValue.serverTimestamp() }),
        subscriptionExpiresAt: trialExpiry,
        city: city.trim(),
        address: typeof address === 'string' ? address.trim() : (existingData?.address || ''),
        ...(validServiceArea && serviceArea ? {
          serviceArea: {
            state: serviceArea.state.trim(),
            district: serviceArea.district.trim(),
            tehsil: serviceArea.tehsil.trim(),
            stateKey: serviceAreaKey(serviceArea.state),
            districtKey: serviceAreaKey(serviceArea.district),
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
        ...(existingData?.createdAt ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp()
      };
      if (existing.exists) transaction.update(userRef, partnerFields);
      else transaction.create(userRef, partnerFields);
      if (quickFixIdRef && !quickFixIdIndexExists) {
        transaction.create(quickFixIdRef, { uid: identity.uid, accountType: 'CHANNEL_PARTNER', createdAt: FieldValue.serverTimestamp() });
      }
    });

    return res.status(201).json({
      success: true,
      quickFixId: issuedPartnerQuickFixId,
      approvalStatus: 'pending_audit',
      message: 'Basic partner profile created. KYC and approval are still pending; no deposit was collected.'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROFILE_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, error: 'An account already exists for this verified mobile number. Please use the correct sign-in option.' });
    }
    if (error instanceof Error && error.message === 'PARTNER_ID_INDEX_CONFLICT') {
      return res.status(409).json({ success: false, error: 'This Partner QuickFix ID is already linked to another account. Please contact support.' });
    }
    console.error('Secure partner registration failed:', error);
    return res.status(500).json({ success: false, error: 'Partner registration could not be saved securely. Please retry.' });
  }
});

// Existing Channel Partner sign-in: Firebase verifies the phone; this endpoint verifies the partner role and returns only the signed-in user's own safe profile.
app.get('/api/partners/profile', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner authentication is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const snapshot = await getFirestore(firebaseAdminApp).collection('users').doc(identity.uid).get();
    if (!snapshot.exists) return res.status(403).json({ success: false, error: 'No registered Channel Partner account was found for this mobile number.' });
    const data = snapshot.data()!;
    const roles = Array.isArray(data.roles) ? data.roles : [data.role];
    const isPartner = roles.some((role: unknown) => typeof role === 'string' && ['CHANNEL_PARTNER', 'TECHNICIAN'].includes(role.toUpperCase()));
    if (!isPartner || data.phoneNumber !== identity.phone_number) {
      return res.status(403).json({ success: false, error: 'This mobile number is not linked to a registered Channel Partner account.' });
    }
    let partnerQuickFixId = '';
    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(userRef);
      const freshData = fresh.data() || {};
      const storedId = typeof freshData.partnerQuickFixId === 'string'
        ? freshData.partnerQuickFixId.trim().toUpperCase()
        : '';
      const hasValidStoredId = /^QFP-\d{8}$/.test(storedId);

      if (hasValidStoredId) {
        const storedIndexRef = db.collection('quickfix_id_index').doc(storedId);
        const storedIndex = await transaction.get(storedIndexRef);
        if (storedIndex.exists && storedIndex.data()?.uid !== identity.uid) {
          throw new Error('QUICKFIX_ID_INDEX_CONFLICT');
        }
        partnerQuickFixId = storedId;
        if (!storedIndex.exists) {
          transaction.create(storedIndexRef, {
            uid: identity.uid,
            accountType: 'CHANNEL_PARTNER',
            createdAt: FieldValue.serverTimestamp(),
            repairedAt: FieldValue.serverTimestamp()
          });
        }
        if (freshData.partnerQuickFixId !== storedId) {
          transaction.update(userRef, { partnerQuickFixId: storedId, updatedAt: FieldValue.serverTimestamp() });
        }
        return;
      }

      let candidate = '';
      let candidateRef: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const nextId = createQuickFixId('PARTNER');
        const nextRef = db.collection('quickfix_id_index').doc(nextId);
        const collision = await transaction.get(nextRef);
        if (!collision.exists) { candidate = nextId; candidateRef = nextRef; break; }
      }
      if (!candidate || !candidateRef) throw new Error('QUICKFIX_ID_ALLOCATION_FAILED');
      partnerQuickFixId = candidate;
      transaction.update(userRef, { partnerQuickFixId: candidate, updatedAt: FieldValue.serverTimestamp() });
      transaction.create(candidateRef, {
        uid: identity.uid,
        accountType: 'CHANNEL_PARTNER',
        createdAt: FieldValue.serverTimestamp()
      });
    });
    return res.json({
      success: true,
      profile: {
        uid: identity.uid,
        quickFixId: partnerQuickFixId,
        phoneNumber: identity.phone_number,
        displayName: typeof data.displayName === 'string' ? data.displayName : '',
        email: typeof data.email === 'string' ? data.email : '',
        city: typeof data.city === 'string' ? data.city : '',
        address: typeof data.address === 'string' ? data.address : '',
        trades: Array.isArray(data.trades) ? data.trades.filter((trade: unknown) => typeof trade === 'string') : [],
        experienceYears: Number.isInteger(data.experienceYears) ? data.experienceYears : 0,
        isVerified: data.isVerified === true,
        approvalStatus: typeof data.approvalStatus === 'string' ? data.approvalStatus : 'pending_audit',
        isOnline: data.isOnline === true,
        isSuspended: data.isSuspended === true || data.status === 'suspended',
        walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 0,
        securityDepositPaid: data.securityDepositPaid === true
      }
    });
  } catch (error) {
    console.error('Secure partner profile lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Partner account could not be loaded securely. Please try again.' });
  }
});

// Partner-owned UPI payment profile. This only publishes a verified-format VPA for QR display;
// it does not confirm payments or change booking payment status.
// Partner bank destination: full account number is encrypted at rest; only the owner can read/update it.
app.get('/api/partners/bank-account', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure partner bank service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const ref = getFirestore(firebaseAdminApp).collection('users').doc(identity.uid);
    const snap = await ref.get();
    const profile = snap.exists ? snap.data() : undefined;
    const roles = Array.isArray(profile?.roles) ? profile.roles : [profile?.role];
    const isPartner = roles.some((role: unknown) => typeof role === 'string' && ['CHANNEL_PARTNER', 'TECHNICIAN'].includes(role.toUpperCase()));
    if (!snap.exists || !isPartner) {
      return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    }
    const data = snap.data()!;
    return res.json({ success: true, configured: Boolean(data.bankAccountCiphertext), bankName: data.bankName || '', accountType: data.bankAccountType || 'savings', accountLast4: data.bankAccountLast4 || '', ifsc: data.bankIfsc || '', accountHolderName: data.bankAccountHolderName || '' });
  } catch (error) {
    console.error('Partner bank account read failed:', error);
    return res.status(500).json({ success: false, error: 'Bank account could not be loaded securely.' });
  }
});

app.put('/api/partners/bank-account', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure partner bank service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const ref = getFirestore(firebaseAdminApp).collection('users').doc(identity.uid);
    const snap = await ref.get();
    const profile = snap.exists ? snap.data() : undefined;
    const roles = Array.isArray(profile?.roles) ? profile.roles : [profile?.role];
    const isPartner = roles.some((role: unknown) => typeof role === 'string' && ['CHANNEL_PARTNER', 'TECHNICIAN'].includes(role.toUpperCase()));
    if (!snap.exists || !isPartner) {
      return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    }
    const keyText = process.env.PARTNER_BANK_ENCRYPTION_KEY || process.env.ADMIN_BANK_ENCRYPTION_KEY || '';
    let key: Buffer;
    try { key = Buffer.from(keyText, 'base64'); } catch { key = Buffer.alloc(0); }
    if (key.length !== 32) return res.status(503).json({ success: false, error: 'Partner bank encryption is not configured. No bank details were saved.' });
    const { bankName, accountType, accountHolderName, accountNumber, ifsc } = req.body ?? {};
    const cleanBank = typeof bankName === 'string' ? bankName.trim() : '';
    const cleanType = accountType === 'current' ? 'current' : accountType === 'savings' ? 'savings' : '';
    const cleanHolder = typeof accountHolderName === 'string' ? accountHolderName.trim() : '';
    const cleanAccount = typeof accountNumber === 'string' ? accountNumber.replace(/\s/g, '') : '';
    const cleanIfsc = typeof ifsc === 'string' ? ifsc.trim().toUpperCase() : '';
    if (!cleanBank || cleanBank.length > 100 || !cleanType || cleanHolder.length < 2 || cleanHolder.length > 100 ||
        !/^\d{9,18}$/.test(cleanAccount) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      return res.status(400).json({ success: false, error: 'Enter valid bank, Savings/Current type, account holder, 9–18 digit account number and IFSC.' });
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(cleanAccount, 'utf8'), cipher.final()]);
    await ref.update({
      bankName: cleanBank, bankAccountType: cleanType, bankAccountHolderName: cleanHolder, bankIfsc: cleanIfsc,
      bankAccountCiphertext: encrypted.toString('base64'), bankAccountIv: iv.toString('base64'),
      bankAccountAuthTag: cipher.getAuthTag().toString('base64'), bankAccountLast4: cleanAccount.slice(-4),
      bankAccountEncryption: 'AES-256-GCM', bankAccountUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, configured: true, bankName: cleanBank, accountType: cleanType, accountLast4: cleanAccount.slice(-4), ifsc: cleanIfsc, accountHolderName: cleanHolder });
  } catch (error) {
    console.error('Partner bank account save failed:', error);
    return res.status(500).json({ success: false, error: 'Bank account could not be saved securely.' });
  }
});

app.get('/api/partners/payment-profile', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner payment profile is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const ref = getFirestore(firebaseAdminApp).collection('users').doc(identity.uid);
    const snap = await ref.get();
    if (!snap.exists || !hasChannelPartnerRole(snap.data())) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
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
    if (!snap.exists || !hasChannelPartnerRole(snap.data())) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
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
    const validation = validatePartnerRechargePolicy(req.body);
    if (!validation.valid) return res.status(400).json({ success: false, error: validation.error });
    const { trialDays, packages } = validation.value;
    const clean = packages.map((p) => ({
      id: p.id, name: p.name, amountPaise: p.amountRupees * 100,
      durationDays: p.durationDays, active: p.active
    }));
    await getFirestore(firebaseAdminApp).collection('settings').doc('partner_recharge').set({ packages: clean, trialDays, updatedAt: FieldValue.serverTimestamp(), updatedBy: (req as AuthenticatedRequest).firebaseUser!.uid }, { merge: true });
    return res.json({ success: true, trialDays, packages: clean.map(p => ({ id: p.id, name: p.name, amountPaise: p.amountPaise, durationDays: p.durationDays, active: p.active })) });
  } catch (error) {
    console.error('Recharge packages update failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge packages could not be saved.' });
  }
});

// Admin-only recharge ledger. A captured payment is not represented as bank-settled.
app.get('/api/admin/partner-recharge/ledger', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Recharge ledger is temporarily unavailable.' });
    const requestedLimit = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
    const db = getFirestore(firebaseAdminApp);
    const snapshot = await db.collection('partner_recharge_payments')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const rawItems: Array<Record<string, any>> = snapshot.docs.map(document => ({ id: document.id, ...(document.data() || {}) }));
    const partnerUids = Array.from(new Set(rawItems
      .map(item => typeof item.partnerUid === 'string' ? item.partnerUid : '')
      .filter(Boolean)));
    const partnerSnapshots = await Promise.all(partnerUids.map(uid => db.collection('users').doc(uid).get()));
    const partnerProfiles = new Map(partnerSnapshots.map(profile => [profile.id, profile.exists ? profile.data() || {} : {}]));
    const toIso = (value: any) => value && typeof value.toDate === 'function' ? value.toDate().toISOString() : null;
    const items = rawItems.map(item => {
      const profile = partnerProfiles.get(String(item.partnerUid || '')) || {};
      const phone = typeof profile.phoneNumber === 'string' ? profile.phoneNumber : '';
      return {
        id: item.id,
        partnerUid: String(item.partnerUid || ''),
        partnerName: String(profile.displayName || profile.name || 'Channel Partner'),
        partnerPhoneMasked: phone.length > 4 ? '••••' + phone.slice(-4) : '',
        packageName: String(item.packageName || item.packageId || 'Recharge'),
        amountPaise: Number.isInteger(item.amountPaise) ? item.amountPaise : 0,
        currency: item.currency === 'INR' ? 'INR' : 'INR',
        durationDays: Number.isInteger(item.durationDays) ? item.durationDays : 0,
        status: String(item.status || 'unknown'),
        orderId: String(item.orderId || ''),
        paymentId: typeof item.paymentId === 'string' ? item.paymentId : null,
        createdAt: toIso(item.createdAt),
        verifiedAt: toIso(item.verifiedAt)
      };
    });
    const recentPaidTotalPaise = items
      .filter(item => item.status === 'paid')
      .reduce((total, item) => total + item.amountPaise, 0);
    return res.json({
      success: true,
      items,
      count: items.length,
      recentPaidTotalPaise,
      currency: 'INR',
      note: 'Paid means Razorpay capture was verified. Bank settlement must be confirmed separately in the Razorpay Dashboard.'
    });
  } catch (error) {
    console.error('Admin partner recharge ledger read failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge ledger could not be loaded.' });
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
    if (!profile.exists || !hasChannelPartnerRole(profile.data())) return res.status(403).json({ success: false, error: 'Channel Partner account required.' });
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
    if (![rechargeId, orderId, paymentId, signature].every(v => typeof v === 'string' && v.length > 0 && v.length <= 200) ||
        !/^[A-Za-z0-9_-]{1,150}$/.test(rechargeId)) return res.status(400).json({ success: false, error: 'Invalid payment verification details.' });
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
      if (isConflictingPaidPayment(fresh.data()?.status, fresh.data()?.paymentId, paymentId)) throw new Error('RECHARGE_PAYMENT_CONFLICT');
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
    if (error instanceof Error && error.message === 'RECHARGE_PAYMENT_CONFLICT') {
      return res.status(409).json({ success: false, error: 'This recharge is already linked to a different verified payment.' });
    }
    console.error('Partner recharge verification failed:', error);
    return res.status(500).json({ success: false, error: 'Recharge could not be activated safely.' });
  }
});

// Customer quote preview for Android: only approved, effective local rate cards can produce a price.
app.get('/api/bookings/quote', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure rate lookup is temporarily unavailable.' });
    const read = (key: string) => typeof req.query[key] === 'string' ? String(req.query[key]).trim() : '';
    const serviceId = read('serviceId'), state = read('state'), district = read('district');
    const tehsil = read('tehsil'), city = read('city'), date = read('date');
    const quantity = Number(read('quantity'));
    if (!serviceId || serviceId.length > 120 || !state || state.length > 100 || !district || district.length > 100 ||
        !tehsil || tehsil.length > 100 || city.length > 100 || 
        !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !isValidBookingDate(date)) {
      return res.status(400).json({ success: false, error: 'Quote details are invalid.' });
    }
    const service = INITIAL_SERVICES.find(item => item.id === serviceId);
    if (!service) return res.status(404).json({ success: false, error: 'Service is unavailable.' });
    const billing = getBillingProfile(service);
    const db = getFirestore(firebaseAdminApp);
    const snapshot = await db.collection('rate_cards').where('approvalStatus', '==', 'approved').limit(500).get();
    const cards = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as LocationRateCard))
      .filter(card => card.state.trim().toLocaleLowerCase('en-IN') === state.toLocaleLowerCase('en-IN') &&
        card.district.trim().toLocaleLowerCase('en-IN') === district.toLocaleLowerCase('en-IN') &&
        card.serviceCategory === service.category && card.unit === billing.unit);
    const card = resolveLocationRateCard(cards, { state, district, city, tehsil }, service.category, service.id, billing.unit, date);
    if (!card) return res.json({ success: true, quoteAvailable: false, pricingStatus: 'inspection_quote_required',
      serviceTitle: service.title, billingUnit: billing.unit, quantity,
      message: 'No approved rate is available for this exact service and location. Obtain an itemised quote before work starts.' });
    const quote = calculateRateQuote(card, quantity);
    return res.json({ success: true, quoteAvailable: true, pricingStatus: 'priced_from_approved_rate_card',
      serviceTitle: service.title, billingUnit: billing.unit, quantity, quote,
      materialsIncluded: quote.materialsIncluded, rateSourceName: card.sourceName,
      effectiveFrom: card.effectiveFrom, effectiveTo: card.effectiveTo || null });
  } catch (error) {
    console.error('Customer quote preview failed:', error);
    return res.status(500).json({ success: false, error: 'A secure rate quote could not be calculated.' });
  }
});

// Customer booking creation: server derives the service price and customer identity.
// No client-supplied role, price, OTP, assignment, payment or wallet value is trusted.
app.post('/api/bookings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { serviceId, scheduledDate, scheduledTimeSlot, address, notes, paymentMethod, serviceArea, quantity, customerLocation } = req.body ?? {};
    const requestedLines = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [{ serviceId, quantity }];
    const validCustomerLocation = customerLocation !== null && typeof customerLocation === 'object' && !Array.isArray(customerLocation) &&
      typeof customerLocation.latitude === 'number' && Number.isFinite(customerLocation.latitude) &&
      customerLocation.latitude >= -90 && customerLocation.latitude <= 90 &&
      typeof customerLocation.longitude === 'number' && Number.isFinite(customerLocation.longitude) &&
      customerLocation.longitude >= -180 && customerLocation.longitude <= 180;
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
    if (!['upi', 'card', 'netbanking', 'cash'].includes(paymentMethod)) invalidFields.push('paymentMethod');
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
    const profile = profileSnap.exists ? profileSnap.data()! : undefined;
    const hasCustomerAccess = profile?.role === 'CUSTOMER' ||
      (Array.isArray(profile?.roles) && profile.roles.includes('CUSTOMER'));
    if (!profile || !hasCustomerAccess) {
      return res.status(403).json({ success: false, error: 'A registered customer profile is required to book a service.' });
    }
    const resolvedLines: Array<{ service: (typeof INITIAL_SERVICES)[number]; quantity: number; billing: ReturnType<typeof getBillingProfile> }> = requestedLines.map((line: any) => {
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
      baseFee?: number;
      minimumCharge?: number;
      appliedAdjustmentPercent?: number;
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
          unitRateMinimum: quote.rateMinimum,
          unitRateMaximum: quote.rateMaximum,
          baseFee: quote.baseFee,
          minimumCharge: quote.minimumCharge,
          appliedAdjustmentPercent: quote.appliedAdjustmentPercent,
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
    if (['upi', 'card', 'netbanking'].includes(paymentMethod) && !allLinesPriced) {
      return res.status(409).json({
        success: false,
        error: 'Online payment needs an approved local rate card and confirmed booking amount. Choose Cash or request an inspection quote; no payment has been collected.'
      });
    }
    const totalMinimum = lineItems.reduce((sum, line) => sum + line.lineTotalMinimum, 0);
    const totalMaximum = lineItems.reduce((sum, line) => sum + line.lineTotalMaximum, 0);
    const priceConsent = req.body?.priceConsent;
    if (priceConsent !== undefined && (!priceConsent || typeof priceConsent !== 'object' || priceConsent.accepted !== true ||
        !Number.isFinite(priceConsent.quoteMinimum) || !Number.isFinite(priceConsent.quoteMaximum) ||
        priceConsent.quoteMinimum < 0 || priceConsent.quoteMaximum < priceConsent.quoteMinimum ||
        Math.abs(priceConsent.quoteMinimum - totalMinimum) > 0.01 || Math.abs(priceConsent.quoteMaximum - totalMaximum) > 0.01)) {
      return res.status(409).json({ success: false, error: 'The displayed quote changed. Please review the latest price and accept it again.' });
    }
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
      serviceArea: { state: serviceArea.state.trim(), district: serviceArea.district.trim(), tehsil: serviceArea.tehsil.trim(), stateKey: serviceAreaKey(serviceArea.state), districtKey: serviceAreaKey(serviceArea.district) },
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
      ...(priceConsent ? { priceConsent: { accepted: true, acceptedBy: identity.uid, acceptedAt: FieldValue.serverTimestamp(), quoteMinimum: totalMinimum, quoteMaximum: totalMaximum, pricingStatus: allLinesPriced ? 'priced_from_approved_rate_card' : 'inspection_quote_required', lineItems } } : {}),
      status: 'requested',
      startOtp: '',
      price: allLinesPriced ? totalMinimum : 0,
      totalAmount: allLinesPriced ? totalMinimum : 0,
      // Market-rate model: no platform commission is charged on bookings.
      // Partner earnings remain unset until the final service quote is confirmed.
      commissionRate: 0,
      effectiveCommissionRate: 0,
      adminCommission: 0,
      technicianPayout: 0,
      acceptanceCommissionDebited: false,
      acceptanceCommissionAmount: 0,
      paymentCollectionEnabled: false,
      paymentStatus: 'pending',
      escrowStatus: 'not_funded',
      createdAt: FieldValue.serverTimestamp()
    });
    const partnerNotification = await notifyEligiblePartnersOfBooking(db, {
      id: bookingRef.id,
      serviceTitle: primary.service.title,
      category: primary.service.category,
      city: String(profile.city || '').slice(0, 100),
      serviceArea: { state: serviceArea.state.trim(), district: serviceArea.district.trim(), tehsil: serviceArea.tehsil.trim() },
      customerLocation
    });
    return res.status(201).json({
      success: true,
      bookingId: bookingRef.id,
      pricingStatus: allLinesPriced ? 'priced' : 'inspection_quote_required',
      quoteRange: { minimum: totalMinimum, maximum: totalMaximum },
      lineItems,
      partnerNotification: {
        status: partnerNotification.status,
        eligiblePartners: partnerNotification.eligiblePartners,
        devices: partnerNotification.devices
      }
    });
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
    if (!['upi', 'card', 'netbanking'].includes(b.paymentMethod) || b.status !== 'requested' || b.paymentStatus !== 'pending') return res.status(409).json({success:false,error:'Booking is not eligible for online payment.'});
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
      if (isConflictingPaidPayment(fresh.data()?.paymentStatus, fresh.data()?.paymentId, paymentId)) throw new Error('BOOKING_PAYMENT_CONFLICT');
      if (fresh.data()?.paymentStatus==='paid') return;
      tx.update(ref,{paymentStatus:'paid',escrowStatus:'not_funded',paymentId,paymentCapturedAt:FieldValue.serverTimestamp(),paymentUpdatedAt:FieldValue.serverTimestamp()});
    });
    return res.json({success:true,paymentStatus:'paid'});
  } catch(e) {
    if (e instanceof Error && e.message==='BOOKING_PAYMENT_CONFLICT') return res.status(409).json({success:false,error:'This booking is already linked to a different verified payment.'});
    console.error('Razorpay verification failed:',e);
    return res.status(500).json({success:false,error:'Payment verification could not be completed safely.'});
  }
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
    // Only payment.captured carries the captured payment entity needed for exact verification.
    // order.paid is deliberately ignored because its payload may not identify a specific payment.
    if (event !== 'payment.captured') return res.json({success:true,ignored:true});
    const orderId=p?.order_id, paymentId=p?.id, amount=p?.amount, currency=p?.currency;
    if (p?.status !== 'captured' || typeof orderId!=='string' || typeof paymentId!=='string' ||
        !Number.isSafeInteger(amount) || amount <= 0 || currency!=='INR') {
      return res.status(400).json({success:false,error:'Incomplete or uncaptured payment event.'});
    }
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
        } else if (isConflictingPaidPayment(r.status, r.paymentId, paymentId)) {
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
      if (isConflictingPaidPayment(b.paymentStatus, b.paymentId, paymentId)) throw new Error('BOOKING_PAYMENT_CONFLICT');
      if (b.paymentStatus!=='paid') tx.update(bookingRef,{paymentStatus:'paid',escrowStatus:'not_funded',paymentId,paymentCapturedAt:FieldValue.serverTimestamp(),paymentUpdatedAt:FieldValue.serverTimestamp()});
      tx.create(eventRef,{eventId,event,orderId,paymentId,processedAt:FieldValue.serverTimestamp(),kind:'booking'});
    });
    return res.json({success:true,received:true,kind:'booking'});
  } catch(e) {
    if (e instanceof Error && e.message==='BOOKING_PAYMENT_CONFLICT') return res.status(409).json({success:false,error:'Booking is already linked to a different verified payment.'});
    console.error('Razorpay webhook failed:',e);
    return res.status(409).json({success:false,error:'Webhook could not be applied safely.'});
  }
});

// Channel Partner job feed. It reveals only eligible, unassigned requests and never
// exposes customer contact details, notes, OTPs, payment data or the full address.
// Partner-controlled dispatch radius and GPS pin. Updates are scoped to the authenticated partner.
app.get('/api/partners/dispatch-settings', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner settings are temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const snapshot = await getFirestore(firebaseAdminApp).collection('users').doc(identity.uid).get();
    if (!snapshot.exists || !hasChannelPartnerRole(snapshot.data())) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
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
    if (!profile.exists || !hasChannelPartnerRole(profile.data())) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    await userRef.update({ dispatchRadiusKm, dispatchLocation: { latitude: dispatchLocation.latitude, longitude: dispatchLocation.longitude }, dispatchLocationUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, dispatchRadiusKm, locationConfigured: true });
  } catch (error) {
    console.error('Partner dispatch settings update failed:', error);
    return res.status(500).json({ success: false, error: 'Partner dispatch settings could not be saved.' });
  }
});
app.post('/api/partners/duty-status', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner duty service is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { online, location } = req.body ?? {};
    if (typeof online !== 'boolean') return res.status(400).json({ success: false, error: 'A valid online/offline status is required.' });
    const validPoint = location && typeof location === 'object' && !Array.isArray(location) &&
      typeof location.latitude === 'number' && Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90 &&
      typeof location.longitude === 'number' && Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180 &&
      (location.accuracyMeters === undefined || (typeof location.accuracyMeters === 'number' && Number.isFinite(location.accuracyMeters) && location.accuracyMeters >= 0 && location.accuracyMeters <= 1000));
    if (online && !validPoint) return res.status(400).json({ success: false, error: 'Valid live GPS coordinates are required to activate duty.' });

    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(userRef);
      if (!snapshot.exists) throw new Error('PARTNER_PROFILE_NOT_FOUND');
      const profile = snapshot.data()!;
      if (!hasChannelPartnerRole(profile)) throw new Error('PARTNER_PROFILE_REQUIRED');
      if (profile.isSuspended === true || profile.status === 'suspended') throw new Error('PARTNER_SUSPENDED');
      if (!online) {
        transaction.update(userRef, {
          isOnline: false,
          dutyStatusUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        return { isOnline: false, walletBalance: Number(profile.walletBalance) || 0, dispatchRadiusKm: Number(profile.dispatchRadiusKm) || 5, location: profile.dispatchLocation || null };
      }
      const trades = Array.isArray(profile.trades) ? profile.trades.filter((trade: unknown) => typeof trade === 'string') : [];
      if (typeof profile.city !== 'string' || profile.city.trim().length < 2 || trades.length === 0) throw new Error('PARTNER_SERVICE_PROFILE_REQUIRED');
      if (!canActivatePartnerDuty(profile)) {
        if (profile.isVerified !== true || profile.approvalStatus !== 'approved' || profile.kycStatus === 'rejected') throw new Error('PARTNER_APPROVAL_REQUIRED');
        if (profile.subscriptionStatus === 'expired') throw new Error('PARTNER_SUBSCRIPTION_EXPIRED');
        throw new Error('PARTNER_DUTY_NOT_ELIGIBLE');
      }
      const dispatchRadiusKm = [1, 3, 5, 10, 15].includes(profile.dispatchRadiusKm) ? profile.dispatchRadiusKm : 5;
      const dispatchLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        ...(typeof location.accuracyMeters === 'number' ? { accuracyMeters: location.accuracyMeters } : {})
      };
      transaction.update(userRef, {
        isOnline: true,
        dispatchRadiusKm,
        dispatchLocation,
        dispatchLocationUpdatedAt: FieldValue.serverTimestamp(),
        dutyStatusUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      return { isOnline: true, walletBalance: Number(profile.walletBalance), dispatchRadiusKm, location: dispatchLocation };
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const known: Record<string, { status: number; message: string }> = {
      PARTNER_PROFILE_NOT_FOUND: { status: 404, message: 'Channel Partner profile was not found.' },
      PARTNER_PROFILE_REQUIRED: { status: 403, message: 'A registered Channel Partner profile is required.' },
      PARTNER_SUSPENDED: { status: 403, message: 'Duty is blocked because this partner account is suspended.' },
      PARTNER_SERVICE_PROFILE_REQUIRED: { status: 403, message: 'Approved city and service trades are required before going online.' },
      PARTNER_APPROVAL_REQUIRED: { status: 403, message: 'Admin KYC and trade approval are required before going online.' },
      PARTNER_SUBSCRIPTION_EXPIRED: { status: 403, message: 'Your partner subscription has expired. Recharge before going online.' },
      PARTNER_DUTY_NOT_ELIGIBLE: { status: 403, message: 'This partner profile is not currently eligible for duty.' }
    };
    if (known[code]) return res.status(known[code].status).json({ success: false, error: known[code].message });
    console.error('Partner duty status update failed:', error);
    return res.status(500).json({ success: false, error: 'Partner duty status could not be updated securely.' });
  }
});

app.get('/api/partners/bookings/mine', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking history is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const db = getFirestore(firebaseAdminApp);
    const [byUid, byLegacyId] = await Promise.all([
      db.collection('bookings').where('technicianUid', '==', uid).limit(100).get(),
      db.collection('bookings').where('technicianId', '==', uid).limit(100).get()
    ]);
    const unique = new Map<string, any>();
    [...byUid.docs, ...byLegacyId.docs].forEach(doc => unique.set(doc.id, doc));
    const bookings = [...unique.values()].map(doc => {
      const item = doc.data();
      const createdAt = item.createdAt?.toDate?.()?.toISOString?.() || String(item.createdAt || '');
      return { id: doc.id, serviceTitle: String(item.serviceTitle || item.serviceName || 'QuickFix Service'),
        category: String(item.category || ''), scheduledDate: String(item.scheduledDate || ''),
        scheduledTimeSlot: String(item.scheduledTimeSlot || ''), status: String(item.status || 'unknown'), createdAt };
    }).sort((a,b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return res.json({ success: true, bookings });
  } catch (error) {
    console.error('Partner booking history failed:', error);
    return res.status(500).json({ success: false, error: 'Partner bookings could not be loaded securely.' });
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
          lineItems: Array.isArray(booking.lineItems) ? booking.lineItems.map((line: any) => ({
            serviceId: String(line.serviceId || ''),
            serviceTitle: String(line.serviceTitle || 'Service item'),
            category: String(line.category || ''),
            quantity: Number(line.quantity || 0),
            billingUnit: String(line.billingUnit || ''),
            pricingStatus: String(line.pricingStatus || 'quote_required'),
            ...(Number.isFinite(line.unitRateMinimum) ? { unitRateMinimum: Number(line.unitRateMinimum) } : {}),
            ...(Number.isFinite(line.unitRateMaximum) ? { unitRateMaximum: Number(line.unitRateMaximum) } : {}),
            ...(Number.isFinite(line.baseFee) ? { baseFee: Number(line.baseFee) } : {}),
            ...(Number.isFinite(line.minimumCharge) ? { minimumCharge: Number(line.minimumCharge) } : {}),
            ...(Number.isFinite(line.appliedAdjustmentPercent) ? { appliedAdjustmentPercent: Number(line.appliedAdjustmentPercent) } : {}),
            lineTotalMinimum: Number(line.lineTotalMinimum || 0),
            lineTotalMaximum: Number(line.lineTotalMaximum || 0),
            materialsIncluded: line.materialsIncluded === true,
            rateSourceName: String(line.rateSourceName || '')
          })) : [],
          quoteRange: booking.quoteRange && typeof booking.quoteRange === 'object' ? {
            minimum: Number(booking.quoteRange.minimum || 0),
            maximum: Number(booking.quoteRange.maximum || 0)
          } : null,
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
    const partnerArea = profile.serviceArea && typeof profile.serviceArea === 'object'
      ? profile.serviceArea as Record<string, unknown>
      : null;
    const partnerHasDistrictArea = hasDistrictServiceArea(partnerArea);
    if ((city.length < 2 && !partnerHasDistrictArea) || trades.length === 0) {
      return res.status(403).json({ success: false, error: 'Your approved service area and service trades are required before job access.' });
    }

    // Bounded, cursor-paginated scan permits district-level matching across
    // different city labels while retaining exact-city fallback for legacy records.
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    if (cursor && !/^[A-Za-z0-9_-]{1,150}$/.test(cursor)) {
      return res.status(400).json({ success: false, error: 'Job feed cursor is invalid.' });
    }
    let bookingQuery = db.collection('bookings')
      .where('status', '==', 'requested')
      .orderBy(FieldPath.documentId());
    if (cursor) bookingQuery = bookingQuery.startAfter(cursor);
    const snapshot = await bookingQuery.limit(200).get();

    const bookings = snapshot.docs
      .filter((document) => {
        const booking = document.data();
        if (!canPartnerReceiveBookingCategories(trades, Array.isArray(booking.lineItems) && booking.lineItems.length
          ? booking.lineItems.map((line: any) => line?.category)
          : [booking.category])) return false;
        if (!isWithinPartnerDispatchRadius(profile, booking)) return false;
        const bookingArea = booking.serviceArea && typeof booking.serviceArea === 'object'
          ? booking.serviceArea as Record<string, unknown>
          : null;
        return matchesPartnerServiceArea(partnerArea, bookingArea, city, booking.city);
      })
      .map((document) => {
        const booking = document.data();
        return {
          id: document.id,
          serviceTitle: String(booking.serviceTitle || ''),
          category: String(booking.category || ''),
          customerName: String(booking.customerName || ''),
          customerPhone: String(booking.customerPhone || ''),
          customerAddress: String(booking.customerAddress || booking.address || ''),
          city: String(booking.city || ''),
          pincode: String(booking.pincode || ''),
          state: String(booking.serviceArea?.state || ''),
          district: String(booking.serviceArea?.district || ''),
          tehsil: String(booking.serviceArea?.tehsil || ''),
          scheduledDate: String(booking.scheduledDate || ''),
          scheduledTimeSlot: String(booking.scheduledTimeSlot || ''),
          paymentMethod: String(booking.paymentMethod || ''),
          paymentStatus: String(booking.paymentStatus || 'pending'),
          pricingStatus: String(booking.pricingStatus || ''),
          createdAt: booking.createdAt && typeof booking.createdAt.toDate === 'function' ? booking.createdAt.toDate().toISOString() : String(booking.createdAt || ''),
          updatedAt: booking.updatedAt && typeof booking.updatedAt.toDate === 'function' ? booking.updatedAt.toDate().toISOString() : String(booking.updatedAt || ''),
          status: 'requested',
          price: Number(booking.price || 0),
          totalAmount: Number(booking.totalAmount || 0),
          lineItems: Array.isArray(booking.lineItems) ? booking.lineItems.map((line: any) => ({
            serviceId: String(line.serviceId || ''),
            serviceTitle: String(line.serviceTitle || 'Service item'),
            category: String(line.category || ''),
            quantity: Number(line.quantity || 0),
            billingUnit: String(line.billingUnit || ''),
            pricingStatus: String(line.pricingStatus || 'quote_required'),
            ...(Number.isFinite(line.unitRateMinimum) ? { unitRateMinimum: Number(line.unitRateMinimum) } : {}),
            ...(Number.isFinite(line.unitRateMaximum) ? { unitRateMaximum: Number(line.unitRateMaximum) } : {}),
            lineTotalMinimum: Number(line.lineTotalMinimum || 0),
            lineTotalMaximum: Number(line.lineTotalMaximum || 0),
            materialsIncluded: line.materialsIncluded === true,
            rateSourceName: String(line.rateSourceName || '')
          })) : [],
          quoteRange: booking.quoteRange && typeof booking.quoteRange === 'object' ? {
            minimum: Number(booking.quoteRange.minimum || 0),
            maximum: Number(booking.quoteRange.maximum || 0)
          } : null,
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
      const partnerArea = partner.serviceArea && typeof partner.serviceArea === 'object'
        ? partner.serviceArea as Record<string, unknown> : null;
      const bookingArea = booking.serviceArea && typeof booking.serviceArea === 'object'
        ? booking.serviceArea as Record<string, unknown> : null;
      if (!matchesPartnerServiceArea(partnerArea, bookingArea, city, booking.city) ||
          !canPartnerReceiveBookingCategories(trades, Array.isArray(booking.lineItems) && booking.lineItems.length
            ? booking.lineItems.map((line: any) => line?.category)
            : [booking.category])) {
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
    if (code === 'PARTNER_NOT_ELIGIBLE') return res.status(403).json({ success: false, error: 'Job acceptance requires approved KYC and online status.' });
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
    if (!partnerSnap.exists || !hasChannelPartnerRole(partnerSnap.data())) {
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
// Canonical admin booking feed: the same Firestore booking document used by Customer and Channel Partner.
app.get('/api/admin/bookings', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is temporarily unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('bookings')
      .orderBy('createdAt', 'desc').limit(100).get();
    const iso = (value: any) => value && typeof value.toDate === 'function'
      ? value.toDate().toISOString()
      : typeof value === 'string' ? value : '';
    const bookings = snapshot.docs.map(document => {
      const b = document.data();
      const serviceArea = b.serviceArea && typeof b.serviceArea === 'object' ? b.serviceArea : {};
      const quoteRange = b.quoteRange && typeof b.quoteRange === 'object' ? b.quoteRange : null;
      return {
        id: document.id, serviceId: String(b.serviceId || ''),
        serviceTitle: String(b.serviceTitle || b.serviceName || 'QuickFix Service'),
        category: String(b.category || ''), customerUid: String(b.customerUid || ''),
        customerName: String(b.customerName || ''), customerPhone: String(b.customerPhone || ''),
        customerAddress: String(b.customerAddress || b.address || ''), city: String(b.city || ''),
        pincode: String(b.pincode || ''), state: String(serviceArea.state || ''),
        district: String(serviceArea.district || ''), tehsil: String(serviceArea.tehsil || ''),
        scheduledDate: String(b.scheduledDate || ''), scheduledTimeSlot: String(b.scheduledTimeSlot || ''),
        notes: String(b.notes || ''), status: String(b.status || 'requested'),
        technicianId: String(b.technicianUid || b.technicianId || ''),
        technicianName: String(b.technicianName || ''), technicianPhone: String(b.technicianPhone || ''),
        lineItems: Array.isArray(b.lineItems) ? b.lineItems : [],
        quoteRange: quoteRange ? { minimum: Number(quoteRange.minimum || 0), maximum: Number(quoteRange.maximum || 0) } : null,
        pricingStatus: String(b.pricingStatus || ''), price: Number(b.price || 0),
        totalAmount: Number(b.totalAmount || 0), paymentMethod: String(b.paymentMethod || ''),
        paymentStatus: String(b.paymentStatus || 'pending'), createdAt: iso(b.createdAt),
        updatedAt: iso(b.updatedAt), acceptedAt: iso(b.acceptedAt), serviceDeadline: iso(b.serviceDeadline)
      };
    });
    return res.json({ success: true, bookings });
  } catch (error) {
    console.error('Admin canonical booking feed failed:', error);
    return res.status(500).json({ success: false, error: 'Admin bookings could not be loaded securely.' });
  }
});

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
        customerUid: String(booking.customerUid || ''),
        customerName: String(booking.customerName || ''),
        customerPhone: String(booking.customerPhone || ''),
        city: String(booking.city || ''),
        pincode: String(booking.pincode || ''),
        serviceArea: booking.serviceArea && typeof booking.serviceArea === 'object' ? booking.serviceArea : {},
        lineItems: Array.isArray(booking.lineItems) ? booking.lineItems : [],
        quoteRange: booking.quoteRange && typeof booking.quoteRange === 'object' ? booking.quoteRange : null,
        pricingStatus: String(booking.pricingStatus || ''),
        price: Number(booking.price || 0),
        totalAmount: Number(booking.totalAmount || 0),
        paymentMethod: String(booking.paymentMethod || ''),
        paymentStatus: String(booking.paymentStatus || 'pending'),
        technicianId: String(booking.technicianUid || booking.technicianId || ''),
        updatedAt: booking.updatedAt && typeof booking.updatedAt.toDate === 'function' ? booking.updatedAt.toDate().toISOString() : String(booking.updatedAt || ''),
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
  const bookingId = String(req.params.bookingId || '');
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
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
    // A concurrent request may lose the Firestore transaction race after the
    // winning request consumes the one-time OTP. Confirm the persisted state
    // before returning an error so a consumed OTP is consistently reported
    // as not found; never retry the state transition outside the transaction.
    if (firebaseAdminApp) {
      try {
        const latestOtp = await getFirestore(firebaseAdminApp)
          .collection('booking_start_otps').doc(bookingId).get();
        if (!latestOtp.exists) {
          return res.status(404).json({ success: false, error: 'Service-start code was not found.' });
        }
      } catch (stateCheckError) {
        console.error('Could not confirm concurrent service-start state:', stateCheckError);
      }
    }
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
      transaction.update(bookingRef, {
        status: 'completed',
        locationSharing: { customerEnabled: false, partnerEnabled: false },
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(auditRef, { action: 'service_completed', bookingId, partnerUid: identity.uid, createdAt: FieldValue.serverTimestamp() });
    });
    const liveLocationSnapshot = await bookingRef.collection('liveLocations').get();
    await Promise.all(liveLocationSnapshot.docs.map(locationDoc => locationDoc.ref.delete()));
    return res.json({ success: true, bookingId, status: 'completed', locationsCleared: liveLocationSnapshot.size, message: 'Service completion recorded. Shared GPS points were cleared; payment settlement is not implied.' });
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
// Consent-based live location API. Coordinates are server-owned and never exposed
// through direct client Firestore access. Both booking participants must opt in.
const validCoordinates = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
  typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;

async function getLiveLocationParticipant(bookingId: string, uid: string) {
  const db = getFirestore(firebaseAdminApp!);
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'BOOKING_NOT_FOUND' as const };
  const booking = snap.data()!;
  const role = getBookingLocationParticipantRole(booking, uid);
  if (!role) return { error: 'NOT_A_BOOKING_PARTICIPANT' as const };
  if (!isLiveLocationBookingStatus(booking.status)) {
    // A completed/cancelled booking must not retain readable GPS points.
    // Cleanup is idempotent and runs whenever either participant next accesses tracking.
    const partnerUid = booking.technicianUid || booking.assignedPartnerUid;
    const participantUids = [booking.customerUid, partnerUid].filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
    await Promise.all(participantUids.map((participantUid) =>
      ref.collection('liveLocations').doc(participantUid).delete().catch((error) => {
        console.warn('Could not clear ended-booking live-location point:', error);
      })
    ));
    return { error: 'TRACKING_NOT_AVAILABLE_FOR_BOOKING_STATUS' as const };
  }
  return { ref, booking, role };
}

app.get('/api/bookings/:bookingId/location/consent', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const participant = await getLiveLocationParticipant(req.params.bookingId, uid);
    if ('error' in participant) return res.status(participant.error === 'BOOKING_NOT_FOUND' ? 404 : 403).json({ success: false, error: participant.error });
    const sharing = participant.booking.locationSharing || {};
    return res.json({
      success: true,
      ownEnabled: sharing[participant.role + 'Enabled'] === true,
      otherEnabled: sharing[participant.role === 'customer' ? 'partnerEnabled' : 'customerEnabled'] === true,
    });
  } catch (error) {
    console.error('Live location consent lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Could not load location sharing permission.' });
  }
});

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
      // Revocation by either participant ends the shared session for both people.
      // Remove both latest GPS points so a later re-consent cannot expose stale coordinates.
      const locationsRef = participant.ref.collection('liveLocations');
      const partnerUid = participant.booking.technicianUid || participant.booking.assignedPartnerUid;
      const participantUids = [participant.booking.customerUid, partnerUid].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      );
      await Promise.all(participantUids.map((participantUid) =>
        locationsRef.doc(participantUid).delete().catch((error) => {
          console.warn('Could not clear a revoked live-location point:', error);
        })
      ));
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
    if (!areBothLocationConsentsEnabled(sharing)) {
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
    const partnerUid = participant.booking.technicianUid || participant.booking.assignedPartnerUid;
    if (typeof partnerUid !== 'string' || !partnerUid) {
      return res.status(409).json({ success: false, error: 'This booking has no authenticated Channel Partner assignment yet.' });
    }
    const [customerSnap, partnerSnap] = await Promise.all([
      participant.ref.collection('liveLocations').doc(participant.booking.customerUid).get(),
      participant.ref.collection('liveLocations').doc(partnerUid).get(),
    ]);
    const now = Date.now();
    const serialize = (snap: any) => {
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
app.post('/api/audio/transcribe', authenticateFirebaseUser, async (req: Request, res: Response) => {
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
      if (!partner.exists || !hasChannelPartnerRole(partner.data())) throw new Error('PARTNER_PROFILE_REQUIRED');
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
      if (!partner.exists || !hasChannelPartnerRole(partner.data())) throw new Error('PARTNER_PROFILE_REQUIRED');
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

// Authenticated support ticket intake. Tickets are real records, not chat-only placeholders.
app.post('/api/support/tickets', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Support service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const category = typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 40) : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 120) : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 2000) : '';
    if (!['booking','payment','wallet','account','partner','other'].includes(category) || subject.length < 4 || description.length < 10) {
      return res.status(400).json({ success: false, error: 'Select a category and enter a subject and description.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const profile = await db.collection('users').doc(identity.uid).get();
    const ticketRef = db.collection('support_tickets').doc();
    await ticketRef.create({
      ticketId: ticketRef.id, userUid: identity.uid,
      quickFixId: String(profile.data()?.customerQuickFixId || profile.data()?.partnerQuickFixId || ''),
      category, subject, description, status: 'open', priority: 'normal',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    return res.status(201).json({ success: true, ticketId: ticketRef.id, status: 'open' });
  } catch (error) {
    console.error('Support ticket creation failed:', error);
    return res.status(500).json({ success: false, error: 'Your support request could not be saved. Please try again.' });
  }
});


const complaintCategories = new Set([
  'non_payment', 'abuse_or_threat', 'harassment', 'unsafe_conduct',
  'overcharging', 'poor_service', 'property_damage', 'false_booking', 'other'
]);

// Booking-linked complaints: participants only; case decisions remain server-owned.
app.post('/api/complaints', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Complaint service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const bookingId = typeof req.body?.bookingId === 'string' ? req.body.bookingId.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(bookingId) || !complaintCategories.has(category) || description.length < 10 || description.length > 3000) {
      return res.status(400).json({ success: false, error: 'Booking, complaint type, or description is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const bookingSnap = await db.collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) return res.status(404).json({ success: false, error: 'Booking was not found.' });
    const booking = bookingSnap.data()!;
    const isCustomer = booking.customerUid === identity.uid;
    const isPartner = booking.technicianUid === identity.uid;
    if (!isCustomer && !isPartner) return res.status(403).json({ success: false, error: 'Only a participant in this booking can report it.' });
    const caseRef = db.collection('complaints').doc();
    await caseRef.create({
      bookingId, actorUid: identity.uid, actorRole: isCustomer ? 'customer' : 'channel_partner',
      accusedUid: (isCustomer ? booking.technicianUid : booking.customerUid) || null,
      category, description, status: 'open', decision: null, adminNote: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    return res.status(201).json({ success: true, complaintId: caseRef.id, status: 'open' });
  } catch (error) {
    console.error('Complaint submission failed:', error);
    return res.status(500).json({ success: false, error: 'Complaint could not be saved securely.' });
  }
});

app.get('/api/complaints/mine', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Complaint service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const snapshot = await getFirestore(firebaseAdminApp).collection('complaints').where('actorUid', '==', uid).limit(50).get();
    const complaints = snapshot.docs.map(doc => {
      const item = doc.data();
      return { id: doc.id, bookingId: String(item.bookingId || ''), category: String(item.category || ''),
        status: String(item.status || 'open'), decision: item.decision || null, adminNote: item.adminNote || null,
        createdAt: item.createdAt?.toDate?.()?.toISOString?.() || null };
    }).sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('Complaint history read failed:', error);
    return res.status(500).json({ success: false, error: 'Complaint history could not be loaded.' });
  }
});

app.get('/api/admin/complaints', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Admin complaint service is unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('complaints').limit(100).get();
    const complaints = snapshot.docs.map(doc => {
      const item = doc.data();
      return { id: doc.id, bookingId: String(item.bookingId || ''), actorUid: String(item.actorUid || ''),
        actorRole: String(item.actorRole || ''), accusedUid: item.accusedUid || null,
        category: String(item.category || ''), description: String(item.description || ''),
        status: String(item.status || 'open'), decision: item.decision || null, adminNote: item.adminNote || null,
        createdAt: item.createdAt?.toDate?.()?.toISOString?.() || null };
    }).sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('Admin complaint list failed:', error);
    return res.status(500).json({ success: false, error: 'Complaint cases could not be loaded.' });
  }
});

app.post('/api/admin/complaints/:complaintId/review', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Admin complaint service is unavailable.' });
    const complaintId = String(req.params.complaintId || '');
    const status = req.body?.status;
    const decision = typeof req.body?.decision === 'string' ? req.body.decision.trim() : '';
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(complaintId) ||
        !['under_review', 'resolved', 'dismissed'].includes(status) ||
        !['no_action', 'warning_recommended', 'payment_follow_up', 'account_restriction_recommended', 'refund_review'].includes(decision) ||
        adminNote.length < 5 || adminNote.length > 2000) {
      return res.status(400).json({ success: false, error: 'Review status, decision, or review note is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const caseRef = db.collection('complaints').doc(complaintId);
    const auditRef = db.collection('complaint_audit').doc();
    const reviewerUid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const exists = await db.runTransaction(async transaction => {
      const snap = await transaction.get(caseRef);
      if (!snap.exists) return false;
      transaction.update(caseRef, { status, decision, adminNote, reviewedBy: reviewerUid,
        reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, { complaintId, reviewerUid, status, decision, adminNote, createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!exists) return res.status(404).json({ success: false, error: 'Complaint case was not found.' });
    return res.json({ success: true, complaintId, status, decision });
  } catch (error) {
    console.error('Complaint review failed:', error);
    return res.status(500).json({ success: false, error: 'Complaint review could not be saved.' });
  }
});

// Customer Care: search by the permanent QuickFix ID. Only server-authorized admins can access it.
app.get('/api/admin/customer-care/:quickFixId', authenticateFirebaseUser, requireCustomerCareAccess, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure Customer Care lookup is unavailable.' });
    const quickFixId = String(req.params.quickFixId || '').trim().toUpperCase();
    if (!/^QF[CP]-\d{8}$/.test(quickFixId)) return res.status(400).json({ success: false, error: 'Enter a valid QuickFix ID.' });
    const db = getFirestore(firebaseAdminApp);
    const index = await db.collection('quickfix_id_index').doc(quickFixId).get();
    if (!index.exists) return res.status(404).json({ success: false, error: 'No account was found for this QuickFix ID.' });
    const uid = String(index.data()?.uid || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return res.status(404).json({ success: false, error: 'The QuickFix ID record is unavailable.' });
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return res.status(404).json({ success: false, error: 'The account profile is unavailable.' });
    const user = userSnap.data()!;
    const isPartnerAccount = hasChannelPartnerRole(user) || index.data()?.accountType === 'CHANNEL_PARTNER';
    const [customerBookings, partnerBookings, rechargeLedger, accountAudit, kycSubmissions, kycAudit, supportTickets, walletTransactions] = await Promise.all([
      db.collection('bookings').where('customerUid', '==', uid).limit(100).get(),
      db.collection('bookings').where('technicianUid', '==', uid).limit(100).get(),
      isPartnerAccount ? db.collection('partner_recharge_ledger').where('partnerUid', '==', uid).limit(100).get() : Promise.resolve(null),
      db.collection('admin_audit_logs').where('targetUid', '==', uid).limit(100).get(),
      isPartnerAccount ? db.collection('partner_kyc_submissions').where('partnerUid', '==', uid).limit(50).get() : Promise.resolve(null),
      isPartnerAccount ? db.collection('partner_kyc_audit').where('partnerUid', '==', uid).limit(100).get() : Promise.resolve(null),
      db.collection('support_tickets').where('userUid', '==', uid).limit(100).get(),
      db.collection('wallet_transactions').where('userUid', '==', uid).limit(100).get()
    ]);
    const bookingsById = new Map<string, QueryDocumentSnapshot>();
    [...customerBookings.docs, ...partnerBookings.docs].forEach((item) => bookingsById.set(item.id, item));
    const bookings = [...bookingsById.values()].map((item) => {
      const booking = item.data();
      return {
        bookingId: item.id,
        role: booking.customerUid === uid ? 'customer' : 'channel_partner',
        serviceTitle: String(booking.serviceTitle || booking.serviceCategory || ''),
        status: String(booking.status || 'unknown'),
        paymentStatus: String(booking.paymentStatus || 'unknown'),
        totalAmount: typeof booking.totalAmount === 'number' ? booking.totalAmount : null,
        createdAt: booking.createdAt?.toDate?.()?.toISOString?.() || null,
        scheduledDate: String(booking.scheduledDate || '')
      };
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    await db.collection('customer_care_access_logs').add({
      actorUid: (req as AuthenticatedRequest).firebaseUser!.uid,
      targetUid: uid, quickFixId,
      createdAt: FieldValue.serverTimestamp()
    });
    return res.json({
      success: true,
      profile: {
        quickFixId, accountType: String(index.data()?.accountType || (hasChannelPartnerRole(user) ? 'CHANNEL_PARTNER' : 'CUSTOMER')),
        displayName: String(user.displayName || ''), phoneNumber: String(user.phoneNumber || ''),
        email: String(user.email || ''), address: String(user.address || ''), city: String(user.city || ''),
        serviceArea: user.serviceArea || null,
        trades: Array.isArray(user.trades) ? user.trades.filter((v: unknown) => typeof v === 'string') : [],
        accountStatus: String(user.status || (user.isSuspended ? 'suspended' : 'active')),
        approvalStatus: String(user.approvalStatus || 'not_applicable'),
        kycStatus: String(user.kycStatus || 'not_applicable'),
        isVerified: user.isVerified === true, isOnline: user.isOnline === true,
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : null,
        securityDepositPaid: user.securityDepositPaid === true,
        createdAt: user.createdAt?.toDate?.()?.toISOString?.() || null
      },
      bookings, bookingCount: bookings.length,
      partnerRechargeHistory: (rechargeLedger?.docs || []).map((item) => {
        const row = item.data();
        return { id: item.id, amountPaise: typeof row.amountPaise === 'number' ? row.amountPaise : null,
          status: String(row.status || 'unknown'), createdAt: row.createdAt?.toDate?.()?.toISOString?.() || null,
          durationDays: typeof row.durationDays === 'number' ? row.durationDays : null };
      }),
      accountAudit: accountAudit.docs.map((item) => {
        const row = item.data();
        return { id: item.id, action: String(row.action || row.event || 'account_event'),
          reason: String(row.reason || ''), createdAt: row.createdAt?.toDate?.()?.toISOString?.() || null };
      }),
      kycSubmissions: (kycSubmissions?.docs || []).map((item) => {
        const row = item.data();
        // Customer Care receives workflow metadata only, never document URLs or storage paths.
        return { submissionId: item.id, documentType: String(row.documentType || ''),
          status: String(row.status || 'unknown'),
          submittedAt: row.submittedAt?.toDate?.()?.toISOString?.() || null,
          reviewedAt: row.reviewedAt?.toDate?.()?.toISOString?.() || null,
          documentExpiryStatus: String(row.documentExpiryStatus || 'unknown'),
          documentDeletedAt: row.documentDeletedAt?.toDate?.()?.toISOString?.() || null };
      }),
      kycAudit: (kycAudit?.docs || []).map((item) => {
        const row = item.data();
        return { id: item.id, event: String(row.event || 'kyc_event'),
          decision: String(row.decision || ''), reason: String(row.reason || ''),
          createdAt: row.createdAt?.toDate?.()?.toISOString?.() || null };
      }),
      supportTickets: supportTickets.docs.map((item) => {
        const row = item.data();
        return { ticketId: item.id, category: String(row.category || 'other'),
          subject: String(row.subject || ''), description: String(row.description || ''),
          status: String(row.status || 'open'), priority: String(row.priority || 'normal'),
          createdAt: row.createdAt?.toDate?.()?.toISOString?.() || null,
          updatedAt: row.updatedAt?.toDate?.()?.toISOString?.() || null };
      }),
      walletTransactions: (walletTransactions?.docs || []).map((item) => {
        const row = item.data();
        return { id: item.id, type: String(row.type || 'adjustment'),
          amountPaise: typeof row.amountPaise === 'number' ? row.amountPaise : null,
          status: String(row.status || 'unknown'), reference: String(row.reference || ''),
          createdAt: row.createdAt?.toDate?.()?.toISOString?.() || null };
      }),
      walletLedgerStatus: 'not_integrated',
      historyLimits: { bookings: 100, partnerRecharge: 100, accountAudit: 100, kycSubmissions: 50, kycAudit: 100, supportTickets: 100, walletTransactions: 100 }
    });
  } catch (error) {
    console.error('Customer Care QuickFix ID lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Customer Care could not load this account record.' });
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
      if (!hasChannelPartnerRole(partner)) throw new Error('NOT_A_PARTNER');
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
    return res.json({ success: true, configured: true, bankName: data.bankName, accountType: data.accountType || 'savings', accountLast4: data.accountLast4, ifsc: data.ifsc, accountHolderName: data.accountHolderName, updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null });
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
    const { bankName, accountType, accountHolderName, accountNumber, ifsc } = req.body ?? {};
    const cleanBank = typeof bankName === 'string' ? bankName.trim() : '';
    const cleanHolder = typeof accountHolderName === 'string' ? accountHolderName.trim() : '';
    const cleanAccount = typeof accountNumber === 'string' ? accountNumber.replace(/\s/g, '') : '';
    const cleanIfsc = typeof ifsc === 'string' ? ifsc.trim().toUpperCase() : '';
    const cleanAccountType = accountType === 'current' ? 'current' : accountType === 'savings' ? 'savings' : '';
    if (!cleanBank || cleanBank.length > 100 || cleanHolder.length < 2 || cleanHolder.length > 100 || !cleanAccountType ||
        !/^\d{9,18}$/.test(cleanAccount) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      return res.status(400).json({ success: false, error: 'Enter bank, Savings/Current account type, account holder name, 9–18 digit account number and valid IFSC.' });
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(cleanAccount, 'utf8'), cipher.final()]);
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    await getFirestore(firebaseAdminApp).collection('system').doc('admin_payment_bank').set({
      bankName: cleanBank, accountType: cleanAccountType, accountHolderName: cleanHolder, ifsc: cleanIfsc,
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

// Two-sided SOS intake: record authenticated incident reports; no emergency dispatch is implied.
// Channel Partner emergency contact: private to the authenticated partner.
// Saving/removing a contact never sends an alert; SOS dispatch remains a separate integration.
const getPartnerSafetyProfile = async (uid: string) => {
  if (!firebaseAdminApp) return null;
  const snap = await getFirestore(firebaseAdminApp).collection('users').doc(uid).get();
  if (!snap.exists) return null;
  const profile = snap.data() || {};
  const roles = [profile.role, ...(Array.isArray(profile.roles) ? profile.roles : [])]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.toUpperCase());
  return roles.some(role => ['CHANNEL_PARTNER', 'TECHNICIAN'].includes(role)) ? { snap, profile } : null;
};

const getPartnerContactEncryptionKey = (): Buffer | null => {
  const keyText = process.env.PARTNER_CONTACT_ENCRYPTION_KEY || process.env.PARTNER_BANK_ENCRYPTION_KEY || '';
  const key = Buffer.from(keyText, 'base64');
  return key.length === 32 ? key : null;
};

app.get('/api/partners/safety/emergency-contact', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner safety service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const partner = await getPartnerSafetyProfile(uid);
    if (!partner) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    const data = partner.profile;
    if (!data.emergencyContactCiphertext || !data.emergencyContactIv || !data.emergencyContactAuthTag) {
      return res.json({ success: true, contact: null });
    }
    const key = getPartnerContactEncryptionKey();
    if (!key) return res.status(503).json({ success: false, error: 'Emergency contact encryption is not configured on the server.' });
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(data.emergencyContactIv, 'base64'));
    decipher.setAuthTag(Buffer.from(data.emergencyContactAuthTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data.emergencyContactCiphertext, 'base64')), decipher.final()
    ]).toString('utf8');
    const contact = JSON.parse(decrypted) as { name: string; phone: string };
    return res.json({ success: true, contact: { name: contact.name, phone: contact.phone, consentConfirmed: true } });
  } catch (error) {
    console.error('Partner emergency contact read failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contact could not be loaded securely.' });
  }
});

app.put('/api/partners/safety/emergency-contact', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner safety service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/[\s()-]/g, '') : '';
    if (name.length < 2 || name.length > 100 || !/^\+?[1-9]\d{9,14}$/.test(phone) || req.body?.consentConfirmed !== true) {
      return res.status(400).json({ success: false, error: 'Enter a valid contact name and phone, and confirm consent.' });
    }
    const partner = await getPartnerSafetyProfile(uid);
    if (!partner) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    const key = getPartnerContactEncryptionKey();
    if (!key) return res.status(503).json({ success: false, error: 'Emergency contact encryption is not configured. No contact details were saved.' });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ name, phone }), 'utf8'), cipher.final()]);
    const db = getFirestore(firebaseAdminApp);
    await db.collection('users').doc(uid).update({
      emergencyContactCiphertext: encrypted.toString('base64'),
      emergencyContactIv: iv.toString('base64'),
      emergencyContactAuthTag: cipher.getAuthTag().toString('base64'),
      emergencyContactLast4: phone.slice(-4),
      emergencyContactConsentConfirmed: true,
      emergencyContactUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await db.collection('partner_job_audit_logs').add({
      action: 'partner_emergency_contact_saved', partnerUid: uid, createdAt: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, saved: true, message: 'Emergency contact encrypted and saved. No SMS or call is sent by saving it.' });
  } catch (error) {
    console.error('Partner emergency contact update failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contact could not be saved securely.' });
  }
});

app.delete('/api/partners/safety/emergency-contact', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner safety service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const partner = await getPartnerSafetyProfile(uid);
    if (!partner) return res.status(403).json({ success: false, error: 'Registered Channel Partner profile required.' });
    const db = getFirestore(firebaseAdminApp);
    await db.collection('users').doc(uid).update({
      emergencyContactCiphertext: FieldValue.delete(),
      emergencyContactIv: FieldValue.delete(),
      emergencyContactAuthTag: FieldValue.delete(),
      emergencyContactLast4: FieldValue.delete(),
      emergencyContactConsentConfirmed: FieldValue.delete(),
      emergencyContactUpdatedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await db.collection('partner_job_audit_logs').add({
      action: 'partner_emergency_contact_removed', partnerUid: uid, createdAt: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, removed: true });
  } catch (error) {
    console.error('Partner emergency contact removal failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contact could not be removed.' });
  }
});


// Emergency contacts are private to the signed-in account. Client Firestore rules
// deny access; all reads, writes, OTP challenges and deletion are server-owned.
app.get('/api/me/emergency-contacts', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure account service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const snapshot = await getFirestore(firebaseAdminApp).collection('users').doc(identity.uid)
      .collection('emergency_contacts').orderBy('createdAt', 'desc').limit(EMERGENCY_CONTACT_LIMIT).get();
    return res.json({ success: true, contacts: snapshot.docs.map(doc => {
      const data = doc.data();
      return { contactId: doc.id, maskedPhone: String(data.maskedPhone || '******'),
        relationship: String(data.relationship || 'Other'), verified: data.verified === true,
        consent: data.consent === true };
    }) });
  } catch (error) {
    console.error('Emergency contact list failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contacts could not be loaded.' });
  }
});

app.post('/api/me/emergency-contacts/send-otp', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure account service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    if (!identity.phone_number) return res.status(403).json({ success: false, error: 'Verify your own mobile number before adding an emergency contact.' });
    const phone = normalizeEmergencyPhone(req.body?.phoneNumber);
    const relationship = typeof req.body?.relationship === 'string' ? req.body.relationship.trim() : '';
    if (!isValidEmergencyPhone(phone) || phone === identity.phone_number ||
        !['Family', 'Friend', 'Other'].includes(relationship) || req.body?.consent !== true) {
      return res.status(400).json({ success: false, error: 'Enter a valid different mobile number, relationship, and confirm consent.' });
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || '';
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() || '';
    if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid) || !authToken || !isValidEmergencyPhone(fromNumber)) {
      return res.status(503).json({ success: false, error: 'SMS verification is not configured yet. Contact QuickFix support.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    const contactRef = userRef.collection('emergency_contacts').doc(emergencyContactDocId(identity.uid, phone));
    const contactKey = emergencyContactDocId(identity.uid, phone);
    const challengeRef = db.collection('emergency_contact_otp').doc(contactKey);
    const phoneLimitRef = db.collection('emergency_contact_otp_phone_limits').doc(contactKey);
    const accountLimitRef = db.collection('emergency_contact_otp_limits').doc(identity.uid);
    const now = Date.now();
    const otp = String(randomInt(0, 1000000)).padStart(6, '0');
    const salt = String(randomInt(100000000, 999999999));
    const otpHash = hashEmergencyContactOtp(authToken, identity.uid, phone, salt, otp);
    const sendAllowed = await db.runTransaction(async transaction => {
      const [contactSnap, contactsSnap, phoneLimitSnap, accountLimitSnap] = await Promise.all([
        transaction.get(contactRef), transaction.get(userRef.collection('emergency_contacts')),
        transaction.get(phoneLimitRef), transaction.get(accountLimitRef)
      ]);
      if (contactSnap.exists && contactSnap.data()?.verified === true && contactSnap.data()?.consent === true) return 'already_verified' as const;
      const phoneLimit = phoneLimitSnap.data();
      const lastSentAt = Number(phoneLimit?.lastSentAtMs || 0);
      const sentInWindow = Number(phoneLimit?.sentCount || 0);
      const windowStart = Number(phoneLimit?.windowStartMs || 0);
      if (now - lastSentAt < EMERGENCY_CONTACT_OTP_RESEND_MS) return 'cooldown' as const;
      if (now - windowStart < 3600000 && sentInWindow >= EMERGENCY_CONTACT_OTP_PER_PHONE_PER_HOUR) return 'phone_limit' as const;
      const accountLimit = accountLimitSnap.data();
      const accountWindowStart = Number(accountLimit?.windowStartMs || 0);
      const accountSent = Number(accountLimit?.sentCount || 0);
      if (now - accountWindowStart < 3600000 && accountSent >= EMERGENCY_CONTACT_OTP_PER_ACCOUNT_PER_HOUR) return 'account_limit' as const;
      if (contactsSnap.size >= EMERGENCY_CONTACT_LIMIT && !contactSnap.exists) return 'max_contacts' as const;
      transaction.set(contactRef, {
        phoneNumber: phone, maskedPhone: maskEmergencyPhone(phone), relationship,
        consent: true, consentAt: FieldValue.serverTimestamp(), verified: false,
        createdAt: contactSnap.exists ? (contactSnap.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(phoneLimitRef, {
        windowStartMs: now - windowStart >= 3600000 ? now : windowStart,
        sentCount: now - windowStart >= 3600000 ? 1 : sentInWindow + 1,
        lastSentAtMs: now, updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(accountLimitRef, {
        windowStartMs: now - accountWindowStart >= 3600000 ? now : accountWindowStart,
        sentCount: now - accountWindowStart >= 3600000 ? 1 : accountSent + 1,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(challengeRef, {
        uid: identity.uid, otpHash, salt, attempts: 0, sendStatus: 'pending',
        expiresAtMs: now + EMERGENCY_CONTACT_OTP_TTL_MS,
        createdAt: FieldValue.serverTimestamp()
      });
      return 'send' as const;
    });
    if (sendAllowed === 'already_verified') return res.status(409).json({ success: false, error: 'This emergency contact is already verified.' });
    if (sendAllowed === 'cooldown') return res.status(429).json({ success: false, error: 'Wait 60 seconds before requesting another OTP.' });
    if (sendAllowed === 'phone_limit') return res.status(429).json({ success: false, error: 'Maximum 3 OTP messages per contact per hour reached.' });
    if (sendAllowed === 'account_limit') return res.status(429).json({ success: false, error: 'Maximum 5 emergency-contact OTP messages per account per hour reached.' });
    if (sendAllowed === 'max_contacts') return res.status(409).json({ success: false, error: 'You can save up to 3 emergency contacts.' });
    try {
      const form = new URLSearchParams({ To: phone, From: fromNumber,
        Body: 'QuickFix: Someone wants to add this number as an emergency contact. If you agree, share this one-time code only with that person: ' + otp + '. Valid for 5 minutes. If you do not agree, ignore this message.' });
      const providerResponse = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(accountSid) + '/Messages.json', {
        method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(8000)
      });
      if (!providerResponse.ok) {
        const providerError = await providerResponse.json().catch(() => ({})) as { code?: number };
        console.error('Emergency contact OTP SMS rejected:', providerError.code ?? providerResponse.status);
        await challengeRef.set({ sendStatus: 'failed' }, { merge: true });
        return res.status(502).json({ success: false, error: 'OTP SMS could not be sent. Check SMS provider configuration.' });
      }
      await challengeRef.set({ sendStatus: 'sent' }, { merge: true });
      return res.status(202).json({ success: true, message: 'OTP sent. It expires in 5 minutes.' });
    } catch (error) {
      console.error('Emergency contact OTP send failed:', error instanceof Error ? error.name : 'unknown error');
      await challengeRef.set({ sendStatus: 'failed' }, { merge: true });
      return res.status(502).json({ success: false, error: 'OTP SMS could not be sent. Please try again later.' });
    }
  } catch (error) {
    console.error('Emergency contact OTP request failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contact verification could not be started.' });
  }
});

app.post('/api/me/emergency-contacts/verify', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure account service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    if (!identity.phone_number) return res.status(403).json({ success: false, error: 'Verify your own mobile number before verifying an emergency contact.' });
    const otpPepper = process.env.TWILIO_AUTH_TOKEN?.trim() || '';
    if (!otpPepper) return res.status(503).json({ success: false, error: 'OTP verification is temporarily unavailable.' });
    const phone = normalizeEmergencyPhone(req.body?.phoneNumber);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!isValidEmergencyPhone(phone) || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, error: 'Enter the same mobile number and 6-digit OTP.' });
    const db = getFirestore(firebaseAdminApp);
    const contactRef = db.collection('users').doc(identity.uid).collection('emergency_contacts').doc(emergencyContactDocId(identity.uid, phone));
    const challengeRef = db.collection('emergency_contact_otp').doc(emergencyContactDocId(identity.uid, phone));
    const result = await db.runTransaction(async transaction => {
      const [challengeSnap, contactSnap] = await Promise.all([transaction.get(challengeRef), transaction.get(contactRef)]);
      if (!challengeSnap.exists || !contactSnap.exists) return 'missing' as const;
      const challenge = challengeSnap.data()!;
      if (challenge.sendStatus !== 'sent') return 'send_failed' as const;
      if (Number(challenge.expiresAtMs || 0) <= Date.now()) { transaction.delete(challengeRef); return 'expired' as const; }
      const attempts = Number(challenge.attempts || 0);
      if (attempts >= EMERGENCY_CONTACT_OTP_MAX_ATTEMPTS) { transaction.delete(challengeRef); return 'locked' as const; }
      const candidate = hashEmergencyContactOtp(otpPepper, identity.uid, phone, String(challenge.salt || ''), code);
      if (!verifyEmergencyContactOtpHash(candidate, challenge.otpHash)) {
        transaction.update(challengeRef, { attempts: attempts + 1 });
        return 'invalid' as const;
      }
      transaction.update(contactRef, { verified: true, verifiedAt: FieldValue.serverTimestamp(),
        consent: true, updatedAt: FieldValue.serverTimestamp() });
      transaction.delete(challengeRef);
      return 'verified' as const;
    });
    if (result === 'missing') return res.status(404).json({ success: false, error: 'OTP request not found. Request a new code.' });
    if (result === 'send_failed') return res.status(409).json({ success: false, error: 'OTP was not sent. Request a new code.' });
    if (result === 'expired') return res.status(410).json({ success: false, error: 'OTP expired. Request a new code.' });
    if (result === 'locked') return res.status(429).json({ success: false, error: 'Too many incorrect OTP attempts. Request a new code.' });
    if (result === 'invalid') return res.status(400).json({ success: false, error: 'Incorrect OTP. Check the code and try again.' });
    return res.json({ success: true, message: 'Emergency contact verified and saved.' });
  } catch (error) {
    console.error('Emergency contact OTP verification failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contact could not be verified.' });
  }
});

app.delete('/api/me/emergency-contacts/:contactId', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure account service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const contactId = String(req.params.contactId || '');
    if (!/^[a-f0-9]{64}$/.test(contactId)) return res.status(400).json({ success: false, error: 'Emergency contact reference is invalid.' });
    const db = getFirestore(firebaseAdminApp);
    const contactRef = db.collection('users').doc(identity.uid).collection('emergency_contacts').doc(contactId);
    await db.runTransaction(async transaction => {
      const contactSnap = await transaction.get(contactRef);
      if (!contactSnap.exists) return;
      const contactPhone = String(contactSnap.data()?.phoneNumber || '');
      transaction.delete(contactRef);
      if (isValidEmergencyPhone(contactPhone)) transaction.delete(db.collection('emergency_contact_otp').doc(emergencyContactDocId(identity.uid, contactPhone)));
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Emergency contact deletion failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency contact could not be removed.' });
  }
});


type AdminSafetySmsResult = { status: 'not_configured' | 'sent' | 'failed' };

const dispatchAdminSafetySms = async (incident: {
  incidentId: string; bookingId: string; reporterRole: string; incidentType: string;
}): Promise<AdminSafetySmsResult> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const fromNumber = process.env.TWILIO_FROM_NUMBER || '';
  const adminNumber = process.env.SOS_ADMIN_ALERT_TO || '';
  if (!accountSid || !authToken || !fromNumber || !adminNumber) return { status: 'not_configured' };
  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid) ||
      !/^\+[1-9]\d{7,14}$/.test(fromNumber) ||
      !/^\+[1-9]\d{7,14}$/.test(adminNumber)) return { status: 'failed' };
  const body = new URLSearchParams({
    To: adminNumber,
    From: fromNumber,
    Body: 'QuickFix SOS: ' + incident.incidentType + ' for booking ' + incident.bookingId +
      '. Incident ' + incident.incidentId + '. Reporter: ' + incident.reporterRole +
      '. This is not emergency dispatch. Call 112 if immediate danger.'
  });
  try {
    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(accountSid) + '/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.error('QuickFix admin SOS SMS provider rejected request:', response.status);
      return { status: 'failed' };
    }
    return { status: 'sent' };
  } catch (error) {
    console.error('QuickFix admin SOS SMS request failed:', error instanceof Error ? error.name : 'unknown error');
    return { status: 'failed' };
  }
};


type EmergencyContactSmsResult = {
  status: 'not_configured' | 'no_verified_contacts' | 'sent' | 'partial' | 'failed';
  sent: number;
  failed: number;
};

const dispatchEmergencyContactSms = async (uid: string, incident: {
  incidentId: string; incidentType: string;
}): Promise<EmergencyContactSmsResult> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() || '';
  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid) || !authToken || !isValidEmergencyPhone(fromNumber)) {
    return { status: 'not_configured', sent: 0, failed: 0 };
  }
  try {
    const contacts = await getFirestore(firebaseAdminApp!).collection('users').doc(uid)
      .collection('emergency_contacts').where('verified', '==', true).where('consent', '==', true)
      .limit(EMERGENCY_CONTACT_LIMIT).get();
    if (contacts.empty) return { status: 'no_verified_contacts', sent: 0, failed: 0 };
    const results = await Promise.all(contacts.docs.map(async doc => {
      const phone = String(doc.data().phoneNumber || '');
      if (!isValidEmergencyPhone(phone)) return false;
      const form = new URLSearchParams({ To: phone, From: fromNumber,
        Body: 'QuickFix safety alert: A person who listed you as an emergency contact has raised an SOS during an active service booking. Reference: ' +
          incident.incidentId + '. Incident type: ' + incident.incidentType +
          '. Please contact them if you can. If anyone is in immediate danger, call India emergency number 112. This SMS is not emergency-service dispatch.' });
      try {
        const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(accountSid) + '/Messages.json', {
          method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(10000)
        });
        return response.ok;
      } catch (error) {
        console.error('Emergency contact SOS SMS request failed:', error instanceof Error ? error.name : 'unknown error');
        return false;
      }
    }));
    const sent = results.filter(Boolean).length;
    const failed = results.length - sent;
    return { status: sent === results.length ? 'sent' : sent > 0 ? 'partial' : 'failed', sent, failed };
  } catch (error) {
    console.error('Emergency contact SOS lookup failed:', error instanceof Error ? error.name : 'unknown error');
    return { status: 'failed', sent: 0, failed: 1 };
  }
};

app.post('/api/bookings/:bookingId/sos', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure emergency reporting is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    if (!identity.phone_number) return res.status(403).json({ success: false, error: 'Verified mobile number is required to submit a safety report.' });
    const bookingId = String(req.params.bookingId || '');
    const { requestId, incidentType, message } = req.body ?? {};
    if (!isValidSosIncidentInput(bookingId, requestId, incidentType, message)) {
      return res.status(400).json({ success: false, error: 'Emergency report details are invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(bookingId);
    const incidentRef = db.collection('safety_incidents').doc(bookingId + '_' + identity.uid + '_' + requestId);
    const result = await db.runTransaction(async (transaction) => {
      const bookingSnap = await transaction.get(bookingRef);
      if (!bookingSnap.exists) return { status: 'not_found' as const };
      const booking = bookingSnap.data()!;
      if (!isActiveSosBookingStatus(booking.status)) return { status: 'inactive' as const };
      const reporterRole = getSosReporterRole(booking, identity.uid);
      if (!reporterRole) return { status: 'forbidden' as const };
      const existing = await transaction.get(incidentRef);
      if (existing.exists) return { status: 'duplicate' as const, incidentId: incidentRef.id };
      transaction.create(incidentRef, {
        incidentId: incidentRef.id, bookingId, reporterUid: identity.uid,
        reporterRole,
        reporterPhoneVerified: true, incidentType,
        message: typeof message === 'string' ? message.trim().slice(0, 500) : '',
        status: 'received_pending_review', adminSmsStatus: 'not_configured',
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      });
      return { status: 'created' as const, incidentId: incidentRef.id,
        reporterRole };
    });
    if (result.status === 'not_found') return res.status(404).json({ success: false, error: 'Booking not found.' });
    if (result.status === 'forbidden') return res.status(403).json({ success: false, error: 'Only the customer or assigned Channel Partner can report an incident for this booking.' });
    if (result.status === 'inactive') return res.status(409).json({ success: false, error: 'Emergency reporting is available only during an active assigned booking.' });
    let adminSmsStatus: AdminSafetySmsResult['status'] = 'not_configured';
    let emergencyContactSmsStatus: EmergencyContactSmsResult['status'] = 'no_verified_contacts';
    let emergencyContactSmsSent = 0;
    let emergencyContactSmsFailed = 0;
    if (result.status === 'created') {
      const [adminSms, contactSms] = await Promise.all([
        dispatchAdminSafetySms({ incidentId: result.incidentId, bookingId, reporterRole: result.reporterRole, incidentType }),
        dispatchEmergencyContactSms(identity.uid, { incidentId: result.incidentId, incidentType })
      ]);
      adminSmsStatus = adminSms.status;
      emergencyContactSmsStatus = contactSms.status;
      emergencyContactSmsSent = contactSms.sent;
      emergencyContactSmsFailed = contactSms.failed;
      await incidentRef.update({
        adminSmsStatus, adminSmsAttemptedAt: FieldValue.serverTimestamp(),
        emergencyContactSmsStatus, emergencyContactSmsSent, emergencyContactSmsFailed,
        emergencyContactSmsAttemptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      const existing = await incidentRef.get();
      const data = existing.data() || {};
      const savedAdminStatus = data.adminSmsStatus;
      if (savedAdminStatus === 'sent' || savedAdminStatus === 'failed' || savedAdminStatus === 'not_configured') adminSmsStatus = savedAdminStatus;
      const savedContactStatus = data.emergencyContactSmsStatus;
      if (savedContactStatus === 'sent' || savedContactStatus === 'partial' || savedContactStatus === 'failed' ||
          savedContactStatus === 'no_verified_contacts' || savedContactStatus === 'not_configured') emergencyContactSmsStatus = savedContactStatus;
      emergencyContactSmsSent = Number(data.emergencyContactSmsSent || 0);
      emergencyContactSmsFailed = Number(data.emergencyContactSmsFailed || 0);
    }
    return res.status(result.status === 'created' ? 202 : 200).json({
      success: true, incidentId: result.incidentId, duplicate: result.status === 'duplicate',
      status: 'received_pending_review', emergencyDispatchConfigured: false, adminSmsStatus,
      emergencyContactSmsStatus, emergencyContactSmsSent, emergencyContactSmsFailed,
      message: emergencyContactSmsSent > 0
        ? 'आपकी सुरक्षा रिपोर्ट दर्ज हुई है। Admin और verified emergency contacts को SMS provider ने request स्वीकार की है; handset delivery की guarantee नहीं है। यह police/ambulance dispatch नहीं है। तत्काल खतरे में 112 पर सीधे कॉल करें।'
        : 'आपकी सुरक्षा रिपोर्ट QuickFix में दर्ज हुई है। Admin SMS: ' + adminSmsStatus +
          '; emergency contact SMS: ' + emergencyContactSmsStatus +
          '. Emergency services को सूचना नहीं भेजी गई है। तत्काल खतरे में 112 पर सीधे कॉल करें।'
    });
  } catch (error) {
    console.error('Secure SOS incident intake failed:', error);
    return res.status(500).json({ success: false, error: 'Emergency report could not be saved. Please contact local emergency services directly if in immediate danger.' });
  }
});

// Admin-only SOS incident inbox; omit reporter phone, address and free-text report from list responses.
app.get('/api/admin/safety-incidents', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const snapshot = await getFirestore(firebaseAdminApp).collection('safety_incidents').orderBy('createdAt', 'desc').limit(100).get();
    const incidents = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.();
      return { incidentId: doc.id, bookingId: String(data.bookingId || ''), reporterRole: String(data.reporterRole || 'UNKNOWN'),
        incidentType: String(data.incidentType || 'other'), status: String(data.status || 'received_pending_review'),
        adminSmsStatus: String(data.adminSmsStatus || 'not_configured'),
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : null };
    });
    return res.json({ success: true, incidents });
  } catch (error) {
    console.error('Admin safety incident list failed:', error);
    return res.status(500).json({ success: false, error: 'Safety incident list could not be loaded.' });
  }
});
app.patch('/api/admin/safety-incidents/:incidentId', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure admin service is unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const incidentId = String(req.params.incidentId || '');
    const { status, note } = req.body ?? {};
    const allowed = ['acknowledged', 'under_review', 'resolved', 'closed'];
    if (!/^[A-Za-z0-9_-]{8,180}$/.test(incidentId) || typeof status !== 'string' || !allowed.includes(status) ||
        (note !== undefined && (typeof note !== 'string' || note.trim().length > 500))) {
      return res.status(400).json({ success: false, error: 'Safety incident update is invalid.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const incidentRef = db.collection('safety_incidents').doc(incidentId);
    const auditRef = db.collection('safety_incident_audit').doc();
    const updated = await db.runTransaction(async transaction => {
      const incident = await transaction.get(incidentRef);
      if (!incident.exists) return false;
      const before = String(incident.data()?.status || 'received_pending_review');
      transaction.update(incidentRef, { status, adminNote: typeof note === 'string' ? note.trim() : '',
        reviewedBy: identity.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, { incidentId, adminUid: identity.uid, action: 'status_changed', previousStatus: before,
        newStatus: status, note: typeof note === 'string' ? note.trim() : '', createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!updated) return res.status(404).json({ success: false, error: 'Safety incident not found.' });
    return res.json({ success: true, incidentId, status });
  } catch (error) {
    console.error('Admin safety incident update failed:', error);
    return res.status(500).json({ success: false, error: 'Safety incident could not be updated.' });
  }
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
    void runFirestoreStartupProbe();
  });
}

startServer();
