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
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
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

// In-app job-start OTP encryption. Configure OTP_ENCRYPTION_KEY as 64 hex characters
// (32 random bytes) in the Render environment before accepting new bookings.
function getOtpEncryptionKey(): Buffer {
  const configured = process.env.OTP_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(configured)) {
    throw new Error('OTP_ENCRYPTION_KEY must be configured as 64 hexadecimal characters.');
  }
  return Buffer.from(configured, 'hex');
}
function encryptBookingOtp(otp: string) {
  const key = getOtpEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);
  return { iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: encrypted.toString('hex') };
}
function decryptBookingOtp(payload: { iv: string; tag: string; data: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', getOtpEncryptionKey(), Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, 'hex')), decipher.final()]).toString('utf8');
}
function bookingOtpDigest(otp: string): Buffer {
  return createHmac('sha256', getOtpEncryptionKey()).update(otp).digest();
}


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

// Channel Partner onboarding: Firebase Phone Auth proves phone ownership; the server
// creates a pending profile. No KYC numbers, UPI IDs, deposits, or verification flags
// are accepted from the browser.
app.post('/api/partners/register', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const { displayName, trades, experienceYears, qualificationType, qualificationRegNumber, qualificationInstitute, city } = req.body ?? {};
    const allowedTrades = ['electrician', 'plumber', 'ac_repair', 'fridge_repair', 'welder', 'mechanic', 'driver', 'tourist_guide', 'contractor', 'bike_rider', 'labour', 'home_care'];
    const allowedQualifications = ['ITI Trade Certificate', 'Skill India / NSDC Certified', 'State Wireman/Plumber License', 'Govt Polytechnic Diploma'];
    if (!identity.phone_number || !/^\+91\d{10}$/.test(identity.phone_number) ||
        typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 100 ||
        !Array.isArray(trades) || trades.length < 1 || trades.length > 12 ||
        trades.some((trade: unknown) => typeof trade !== 'string' || !allowedTrades.includes(trade)) ||
        !Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 50 ||
        !allowedQualifications.includes(qualificationType) ||
        typeof qualificationRegNumber !== 'string' || qualificationRegNumber.trim().length < 2 || qualificationRegNumber.length > 100 ||
        typeof qualificationInstitute !== 'string' || qualificationInstitute.trim().length < 2 || qualificationInstitute.length > 120 ||
        typeof city !== 'string' || city.trim().length < 2 || city.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Partner registration details are incomplete or invalid.' });
    }
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure partner registration is temporarily unavailable.' });
    const db = getFirestore(firebaseAdminApp);
    const userRef = db.collection('users').doc(identity.uid);
    const walletRef = db.collection('walletAccounts').doc(identity.uid);
    const openingLedgerRef = db.collection('partnerWalletLedger').doc();
    const result = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(userRef);
      if (existing.exists) return 'exists';
      transaction.create(userRef, {
        uid: identity.uid,
        walletBalance: 0,
        securityDepositRequired: 2000,
        securityDepositPaid: false,
        role: 'CHANNEL_PARTNER',
        displayName: displayName.trim(),
        phoneNumber: identity.phone_number,
        email: typeof identity.email === 'string' ? identity.email : '',
        city: city.trim(),
        trades: [...new Set(trades)],
        experienceYears,
        qualificationType,
        qualificationRegNumber: qualificationRegNumber.trim(),
        qualificationInstitute: qualificationInstitute.trim(),
        approvalStatus: 'pending_audit',
        isVerified: false,
        accountStatus: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(walletRef, {
        partnerUid: identity.uid,
        currency: 'INR',
        availableBalance: 0,
        lockedReserve: 0,
        reserveRequired: 2000,
        reserveStatus: 'not_funded',
        withdrawalsEnabled: false,
        schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(openingLedgerRef, {
        partnerUid: identity.uid,
        type: 'account_opened',
        amount: 0,
        currency: 'INR',
        availableBalanceAfter: 0,
        lockedReserveAfter: 0,
        idempotencyKey: 'account-opened-' + identity.uid,
        createdAt: FieldValue.serverTimestamp(),
        note: 'Wallet account created with zero balance. No deposit or payment received.',
      });
      return 'created';
    });
    if (result === 'exists') return res.status(409).json({ success: false, error: 'A QuickFix profile already exists for this account. Please contact support to link partner access safely.' });
    return res.status(201).json({ success: true, status: 'pending_audit', message: 'Phone verified. Partner application submitted for Admin KYC review. No deposit has been collected.' });
  } catch (error) {
    console.error('Partner registration failed:', error);
    return res.status(500).json({ success: false, error: 'Partner application could not be saved. Please retry.' });
  }
});

// Read-only partner wallet view. All balances and ledger records are server-owned.
app.get('/api/partners/wallet', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Wallet service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const db = getFirestore(firebaseAdminApp);
    const profileSnap = await db.collection('users').doc(uid).get();
    const profile = profileSnap.data();
    if (!profileSnap.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(profile?.role))) {
      return res.status(403).json({ success: false, error: 'A Channel Partner account is required.' });
    }

    // Safely initialize legacy partner accounts with a zero-value wallet.
    // This creates no deposit, credit or payment; it only enables a consistent ledger view.
    const accountRef = db.collection('walletAccounts').doc(uid);
    const openingLedgerRef = db.collection('partnerWalletLedger').doc();
    const account = await db.runTransaction(async (transaction) => {
      const accountSnap = await transaction.get(accountRef);
      if (accountSnap.exists) return accountSnap.data();
      transaction.create(accountRef, {
        partnerUid: uid,
        currency: 'INR',
        availableBalance: 0,
        lockedReserve: 0,
        reserveRequired: 2000,
        reserveStatus: 'not_funded',
        withdrawalsEnabled: false,
        schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(openingLedgerRef, {
        partnerUid: uid,
        type: 'account_opened',
        amount: 0,
        currency: 'INR',
        availableBalanceAfter: 0,
        lockedReserveAfter: 0,
        idempotencyKey: 'account-opened-' + uid,
        createdAt: FieldValue.serverTimestamp(),
        note: 'Legacy partner wallet initialized at zero. No deposit or payment received.',
      });
      return {
        availableBalance: 0,
        lockedReserve: 0,
        reserveRequired: 2000,
        reserveStatus: 'not_funded',
        withdrawalsEnabled: false,
      };
    });
    const ledgerSnap = await db.collection('partnerWalletLedger')
      .where('partnerUid', '==', uid).limit(50).get();
    const ledger = ledgerSnap.docs
      .map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          type: String(data.type || 'entry'),
          amount: Number(data.amount || 0),
          currency: 'INR',
          availableBalanceAfter: Number(data.availableBalanceAfter || 0),
          lockedReserveAfter: Number(data.lockedReserveAfter || 0),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          note: String(data.note || '').slice(0, 180),
        };
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return res.json({
      success: true,
      wallet: {
        currency: 'INR',
        availableBalance: account ? Number(account.availableBalance || 0) : 0,
        lockedReserve: account ? Number(account.lockedReserve || 0) : 0,
        reserveRequired: 2000,
        reserveStatus: String(account?.reserveStatus || 'not_funded'),
        withdrawalsEnabled: account?.withdrawalsEnabled === true,
        topupsEnabled: false,
        payoutEnabled: false,
      },
      ledger,
      notice: 'Only verified server-side payment events can change balances. No payment or deposit is implied by this display.',
    });
  } catch (error) {
    console.error('Partner wallet read failed:', error);
    return res.status(500).json({ success: false, error: 'Wallet details could not be loaded.' });
  }
});

app.get('/api/admin/partners/pending', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner review is temporarily unavailable.' });
    const db = getFirestore(firebaseAdminApp);
    const snapshot = await db.collection('users').where('approvalStatus', 'in', ['pending_audit', 'approved']).limit(300).get();
    const partners = snapshot.docs.flatMap((doc) => {
      const profile = doc.data();
      const awaitingApplicationReview = profile.approvalStatus === 'pending_audit';
      const awaitingManualKyc = profile.approvalStatus === 'approved' && profile.isVerified !== true && profile.accountStatus === 'pending_kyc';
      if (!['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(profile.role)) || (!awaitingApplicationReview && !awaitingManualKyc)) return [];
      return [{
        uid: doc.id,
        approvalStatus: String(profile.approvalStatus || ''),
        accountStatus: String(profile.accountStatus || ''),
        name: String(profile.displayName || 'Channel Partner').slice(0, 100),
        phone: String(profile.phoneNumber || '').slice(0, 30),
        city: String(profile.city || '').slice(0, 100),
        trades: Array.isArray(profile.trades) ? profile.trades.filter((trade: unknown) => typeof trade === 'string').slice(0, 12) : [],
        experienceYears: Number.isInteger(profile.experienceYears) ? profile.experienceYears : 0,
        qualificationType: String(profile.qualificationType || '').slice(0, 80),
        qualificationRegNumber: String(profile.qualificationRegNumber || '').slice(0, 100),
        qualificationInstitute: String(profile.qualificationInstitute || '').slice(0, 120),
        createdAt: profile.createdAt?.toDate?.()?.toISOString?.() || null,
      }];
    });
    return res.json({ success: true, partners });
  } catch (error) {
    console.error('Pending partner lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Pending partner applications could not be loaded.' });
  }
});

// Only a Firebase custom-claim Admin can approve or reject a pending partner.
// Approval changes are audited; this endpoint never handles deposits or payouts.
app.post('/api/admin/partners/:partnerUid/review', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    const { decision, reason } = req.body ?? {};
    if (!['approve', 'reject'].includes(decision) ||
        (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 500))) {
      return res.status(400).json({ success: false, error: 'A valid approval decision and optional reason are required.' });
    }
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Partner review is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(req.params.partnerUid);
    const auditRef = db.collection('adminAuditLogs').doc();
    const outcome = await db.runTransaction(async (transaction) => {
      const partner = await transaction.get(partnerRef);
      if (!partner.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(partner.data()?.role))) return 'not_found';
      if (partner.data()?.approvalStatus !== 'pending_audit') return 'not_pending';
      const approved = decision === 'approve';
      transaction.update(partnerRef, {
        approvalStatus: approved ? 'approved' : 'rejected',
        // Application approval is not identity/KYC verification. Keep dispatch disabled
        // until a separate verified document-review flow is implemented.
        isVerified: false,
        accountStatus: approved ? 'pending_kyc' : 'rejected',
        reviewReason: typeof reason === 'string' ? reason.trim().slice(0, 500) : '',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: identity.uid,
      });
      transaction.create(auditRef, {
        action: approved ? 'partner_approved' : 'partner_rejected',
        targetUid: req.params.partnerUid,
        adminUid: identity.uid,
        reason: typeof reason === 'string' ? reason.trim().slice(0, 500) : '',
        createdAt: FieldValue.serverTimestamp(),
      });
      return 'updated';
    });
    if (outcome === 'not_found') return res.status(404).json({ success: false, error: 'Partner profile was not found.' });
    if (outcome === 'not_pending') return res.status(409).json({ success: false, error: 'Only pending partner applications can be reviewed.' });
    return res.json({ success: true, approvalStatus: decision === 'approve' ? 'approved' : 'rejected' });
  } catch (error) {
    console.error('Partner review failed:', error);
    return res.status(500).json({ success: false, error: 'Partner review could not be saved.' });
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
    let otp: string;
    let encryptedOtp: ReturnType<typeof encryptBookingOtp>;
    try {
      otp = String(randomInt(0, 10000)).padStart(4, '0');
      encryptedOtp = encryptBookingOtp(otp);
    } catch (error) {
      console.error('Booking OTP encryption is not configured:', error);
      return res.status(503).json({ success: false, error: 'Secure job-start OTP is not configured yet. Please try again later.' });
    }

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
      // Never store the readable OTP or return it in booking creation responses.
      startOtp: '',
      startOtpEncrypted: encryptedOtp,
      startOtpHash: bookingOtpDigest(otp).toString('hex'),
      startOtpAttempts: 0,
      startOtpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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



// Manual professional-credential verification: an Admin records that the original
// professional certificate was physically inspected. This is not government identity KYC.
app.post('/api/admin/partners/:partnerUid/verify-manual-kyc', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    const { confirmOriginalInspected, inspectionNote } = req.body ?? {};
    if (confirmOriginalInspected !== true || typeof inspectionNote !== 'string' ||
        inspectionNote.trim().length < 5 || inspectionNote.trim().length > 300 ||
        /(?:\b\d{12}\b|\b\d{10}\b|\b[A-Z]{5}\d{4}[A-Z]\b)/i.test(inspectionNote)) {
      return res.status(400).json({ success: false, error: 'Confirm that the original professional certificate was inspected and enter a short inspection note without personal ID numbers.' });
    }
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Manual verification is temporarily unavailable.' });
    const identity = (req as AuthenticatedRequest).firebaseUser!;
    const db = getFirestore(firebaseAdminApp);
    const partnerRef = db.collection('users').doc(req.params.partnerUid);
    const auditRef = db.collection('adminAuditLogs').doc();
    const outcome = await db.runTransaction(async (transaction) => {
      const partner = await transaction.get(partnerRef);
      if (!partner.exists || !['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(partner.data()?.role))) return 'not_found';
      const profile = partner.data()!;
      if (profile.approvalStatus !== 'approved' || profile.isVerified === true || profile.accountStatus !== 'pending_kyc') return 'not_eligible';
      transaction.update(partnerRef, {
        isVerified: true,
        accountStatus: 'active',
        verificationMethod: 'manual_offline_original_inspected',
        manualKycInspectionNote: inspectionNote.trim(),
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: identity.uid,
      });
      transaction.create(auditRef, {
        action: 'partner_manual_kyc_verified',
        targetUid: req.params.partnerUid,
        adminUid: identity.uid,
        method: 'manual_offline_original_inspected',
        inspectionNote: inspectionNote.trim(),
        createdAt: FieldValue.serverTimestamp(),
      });
      return 'verified';
    });
    if (outcome === 'not_found') return res.status(404).json({ success: false, error: 'Partner profile was not found.' });
    if (outcome === 'not_eligible') return res.status(409).json({ success: false, error: 'Only an approved partner awaiting manual KYC can be verified.' });
    return res.json({ success: true, isVerified: true, accountStatus: 'active' });
  } catch (error) {
    console.error('Manual partner KYC verification failed:', error);
    return res.status(500).json({ success: false, error: 'Manual KYC verification could not be saved.' });
  }
});

 
// Read-only Admin wallet audit. Requires a verified Firebase custom admin claim.
app.get('/api/admin/wallet-audit', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Wallet audit is temporarily unavailable.' });
    const db = getFirestore(firebaseAdminApp);
    const accountsSnap = await db.collection('walletAccounts').limit(200).get();
    const accounts = accountsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        partnerUid: doc.id,
        availableBalance: Number(data.availableBalance || 0),
        lockedReserve: Number(data.lockedReserve || 0),
        reserveRequired: Number(data.reserveRequired || 2000),
        reserveStatus: String(data.reserveStatus || 'not_funded'),
        withdrawalsEnabled: data.withdrawalsEnabled === true,
      };
    });
    const ledgerSnap = await db.collection('partnerWalletLedger').orderBy('createdAt', 'desc').limit(300).get();
    const ledger = ledgerSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        partnerUid: String(data.partnerUid || ''),
        type: String(data.type || 'entry'),
        amount: Number(data.amount || 0),
        availableBalanceAfter: Number(data.availableBalanceAfter || 0),
        lockedReserveAfter: Number(data.lockedReserveAfter || 0),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        note: String(data.note || '').slice(0, 180),
      };
    }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return res.json({
      success: true,
      accounts,
      ledger,
      readOnly: true,
      notice: 'Audit-only view. No funds can be credited, debited, reserved, released, approved, or transferred here.',
    });
  } catch (error) {
    console.error('Admin wallet audit failed:', error);
    return res.status(500).json({ success: false, error: 'Wallet audit could not be loaded.' });
  }
});

// Return only the minimum profile fields needed by the Admin dispatch picker.
app.get('/api/admin/partners/verified', authenticateFirebaseUser, requireServerAdmin, async (_req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure partner lookup is temporarily unavailable.' });
    const db = getFirestore(firebaseAdminApp);
    const snapshot = await db.collection('users').where('isVerified', '==', true).get();
    const partners = snapshot.docs.flatMap((doc) => {
      const profile = doc.data();
      const supportedRole = profile.role === 'CHANNEL_PARTNER' || profile.role === 'TECHNICIAN';
      const approved = profile.approvalStatus === 'approved';
      if (!supportedRole || !approved || profile.accountStatus !== 'active' || profile.isSuspended === true) return [];
      return [{ uid: doc.id, name: String(profile.displayName || 'Channel Partner').slice(0, 100), phone: String(profile.phoneNumber || '').slice(0, 30), trades: Array.isArray(profile.trades) ? profile.trades.filter((trade: unknown) => typeof trade === 'string').slice(0, 12) : [], city: String(profile.city || '').slice(0, 100) }];
    });
    return res.json({ success: true, partners });
  } catch (error) {
    console.error('Verified partner lookup failed:', error);
    return res.status(500).json({ success: false, error: 'Verified partners could not be loaded.' });
  }
});
// Admin-only partner assignment. The authenticated Firebase UID is taken from a verified
// TECHNICIAN profile, never from a legacy local/demo technicianId supplied by the client.
app.post('/api/admin/bookings/:bookingId/assign-partner', authenticateFirebaseUser, requireServerAdmin, async (req: Request, res: Response) => {
  try {
    const partnerUid = req.body?.partnerUid;
    if (typeof partnerUid !== 'string' || partnerUid.length < 10 || partnerUid.length > 128) {
      return res.status(400).json({ success: false, error: 'A valid Channel Partner Firebase UID is required.' });
    }
    if (!firebaseAdminApp) {
      return res.status(503).json({ success: false, error: 'Secure assignment is temporarily unavailable.' });
    }

    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(req.params.bookingId);
    const partnerRef = db.collection('users').doc(partnerUid);
    const result = await db.runTransaction(async (transaction) => {
      const [bookingSnap, partnerSnap] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(partnerRef),
      ]);
      if (!bookingSnap.exists) return { error: 'BOOKING_NOT_FOUND' as const };
      if (!partnerSnap.exists) return { error: 'PARTNER_NOT_FOUND' as const };

      const booking = bookingSnap.data()!;
      const partner = partnerSnap.data()!;
      if (booking.status !== 'requested' || booking.technicianUid || booking.assignedPartnerUid) {
        return { error: 'BOOKING_NOT_ASSIGNABLE' as const };
      }
      const supportedRole = partner.role === 'CHANNEL_PARTNER' || partner.role === 'TECHNICIAN';
      const approved = partner.approvalStatus === 'approved';
      const hasMatchingTrade = Array.isArray(partner.trades) && partner.trades.includes(String(booking.category || ''));
      if (!supportedRole || partner.isVerified !== true || !approved || partner.accountStatus !== 'active' || !hasMatchingTrade || partner.isSuspended === true) {
        return { error: 'PARTNER_NOT_ELIGIBLE' as const };
      }

      transaction.update(bookingRef, {
        technicianUid: partnerUid,
        assignedPartnerUid: partnerUid,
        technicianName: String(partner.displayName || '').slice(0, 100),
        technicianPhone: String(partner.phoneNumber || '').slice(0, 30),
        status: 'assigned',
        assignedAt: FieldValue.serverTimestamp(),
        assignedBy: (req as AuthenticatedRequest).firebaseUser!.uid,
      });
      return { success: true as const };
    });

    if ('error' in result) {
      const status = result.error === 'BOOKING_NOT_FOUND' || result.error === 'PARTNER_NOT_FOUND' ? 404
        : result.error === 'BOOKING_NOT_ASSIGNABLE' ? 409 : 403;
      return res.status(status).json({ success: false, error: result.error });
    }
    return res.json({ success: true, bookingId: req.params.bookingId, partnerUid });
  } catch (error) {
    console.error('Secure partner assignment failed:', error);
    return res.status(500).json({ success: false, error: 'Partner could not be assigned securely.' });
  }
});


// Assigned partner acceptance is server-authoritative. The ₹1,000 wallet gate is
// read from the server-owned user profile; acceptance does not debit commission.
app.post('/api/bookings/:bookingId/accept', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(req.params.bookingId);
    const partnerRef = db.collection('users').doc(uid);
    const now = Date.now();
    const acceptedAt = new Date(now);
    const serviceDeadline = new Date(now + 60 * 60 * 1000);

    const outcome = await db.runTransaction(async (transaction) => {
      const [bookingSnap, partnerSnap] = await Promise.all([
        transaction.get(bookingRef), transaction.get(partnerRef)
      ]);
      if (!bookingSnap.exists) return { error: 'not_found' as const };
      if (!partnerSnap.exists) return { error: 'partner_missing' as const };
      const booking = bookingSnap.data()!;
      const partner = partnerSnap.data()!;
      if ((booking.technicianUid || booking.assignedPartnerUid) !== uid) return { error: 'not_assigned' as const };
      if (!['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(partner.role)) ||
          partner.isVerified !== true || partner.approvalStatus !== 'approved' ||
          partner.accountStatus !== 'active' || partner.isSuspended === true) {
        return { error: 'partner_unverified' as const };
      }
      // Idempotent retries must return the original acceptance even if the
      // available balance changes after acceptance; never re-run the entry gate.
      if (booking.status === 'technician_en_route' && booking.acceptedAt) {
        const existingAcceptedAt = booking.acceptedAt?.toDate?.() || booking.acceptedAt;
        const existingDeadline = booking.serviceDeadline?.toDate?.() || booking.serviceDeadline;
        return {
          accepted: true as const,
          acceptedAt: new Date(existingAcceptedAt).toISOString(),
          serviceDeadline: existingDeadline ? new Date(existingDeadline).toISOString() : new Date(new Date(existingAcceptedAt).getTime() + 60 * 60 * 1000).toISOString(),
          walletBalance: Number(booking.acceptanceWalletBalanceChecked || 0),
          alreadyAccepted: true,
        };
      }
      if (booking.status !== 'assigned') return { error: 'bad_status' as const };
      const walletSnap = await transaction.get(db.collection('walletAccounts').doc(uid));
      const wallet = walletSnap.data();
      // Only the dedicated server-owned wallet account is a balance source of truth.
      const availableBalance = wallet?.availableBalance;
      if (!walletSnap.exists || typeof availableBalance !== 'number' || !Number.isFinite(availableBalance) || availableBalance < 1000) {
        return { error: 'wallet_low' as const };
      }
      transaction.update(bookingRef, {
        status: 'technician_en_route',
        acceptedAt: FieldValue.serverTimestamp(),
        serviceDeadline,
        acceptanceWalletBalanceChecked: availableBalance,
        acceptanceWalletCheckedAt: FieldValue.serverTimestamp(),
      });
      return {
        accepted: true as const,
        acceptedAt: acceptedAt.toISOString(),
        serviceDeadline: serviceDeadline.toISOString(),
        walletBalance: availableBalance,
        alreadyAccepted: false,
      };
    });

    if ('error' in outcome) {
      const status = outcome.error === 'not_found' || outcome.error === 'partner_missing' ? 404
        : outcome.error === 'not_assigned' || outcome.error === 'partner_unverified' ? 403
        : outcome.error === 'wallet_low' ? 402 : 409;
      const messages: Record<string, string> = {
        not_found: 'Booking not found.',
        partner_missing: 'Partner profile not found.',
        not_assigned: 'Only the partner assigned to this booking can accept it.',
        partner_unverified: 'Your partner account must be approved, verified and active.',
        wallet_low: 'Server-verified wallet balance must be at least ₹1,000. No job was accepted.',
        bad_status: 'This booking is no longer available to accept.',
      };
      return res.status(status).json({ success: false, error: messages[outcome.error || 'bad_status'] || 'Booking could not be accepted.' });
    }
    return res.json({ success: true, status: 'technician_en_route', ...outcome });
  } catch (error) {
    console.error('Secure partner acceptance failed:', error);
    return res.status(500).json({ success: false, error: 'Booking could not be accepted securely.' });
  }
});

// Customer-only OTP retrieval. The readable code is decrypted only after checking
// Firebase identity, booking ownership, status and expiry.
app.get('/api/bookings/:bookingId/start-otp', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const ref = getFirestore(firebaseAdminApp).collection('bookings').doc(req.params.bookingId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Booking not found.' });
    const booking = snap.data()!;
    if (booking.customerUid !== uid) return res.status(403).json({ success: false, error: 'Only the booking customer can view this OTP.' });
    if (!['assigned', 'technician_en_route'].includes(String(booking.status))) {
      return res.status(409).json({ success: false, error: 'OTP is available after a Channel Partner is assigned.' });
    }
    const expiry = booking.startOtpExpiresAt?.toDate?.() || booking.startOtpExpiresAt;
    if (!expiry || new Date(expiry).getTime() <= Date.now() || !booking.startOtpEncrypted) {
      return res.status(410).json({ success: false, error: 'This job-start OTP has expired. Contact QuickFix support.' });
    }
    const otp = decryptBookingOtp(booking.startOtpEncrypted);
    return res.json({ success: true, otp, expiresAt: new Date(expiry).toISOString() });
  } catch (error) {
    console.error('Customer OTP retrieval failed:', error);
    return res.status(500).json({ success: false, error: 'Could not securely load the job-start OTP.' });
  }
});

// Assigned, verified Channel Partner submits the customer-provided OTP.
// Attempts are counted transactionally and the code expires after 24 hours.
app.post('/api/bookings/:bookingId/start', authenticateFirebaseUser, async (req: Request, res: Response) => {
  try {
    if (!firebaseAdminApp) return res.status(503).json({ success: false, error: 'Secure booking service is unavailable.' });
    const uid = (req as AuthenticatedRequest).firebaseUser!.uid;
    const otp = req.body?.otp;
    if (typeof otp !== 'string' || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'Enter the 4-digit customer OTP.' });
    }
    const db = getFirestore(firebaseAdminApp);
    const bookingRef = db.collection('bookings').doc(req.params.bookingId);
    const partnerRef = db.collection('users').doc(uid);
    const outcome = await db.runTransaction(async (transaction) => {
      const [bookingSnap, partnerSnap] = await Promise.all([transaction.get(bookingRef), transaction.get(partnerRef)]);
      if (!bookingSnap.exists) return 'not_found';
      if (!partnerSnap.exists) return 'partner_missing';
      const booking = bookingSnap.data()!;
      const partner = partnerSnap.data()!;
      if ((booking.technicianUid || booking.assignedPartnerUid) !== uid) return 'not_assigned';
      if (!['CHANNEL_PARTNER', 'TECHNICIAN'].includes(String(partner.role)) ||
          partner.isVerified !== true || partner.approvalStatus !== 'approved' ||
          partner.accountStatus !== 'active' || partner.isSuspended === true) return 'partner_unverified';
      if (booking.status === 'in_progress') return 'already_started';
      if (booking.status !== 'technician_en_route') return 'bad_status';
      const expiry = booking.startOtpExpiresAt?.toDate?.() || booking.startOtpExpiresAt;
      if (!expiry || new Date(expiry).getTime() <= Date.now()) return 'expired';
      const attempts = Number(booking.startOtpAttempts || 0);
      if (attempts >= 5) return 'locked';
      const expected = typeof booking.startOtpHash === 'string' ? Buffer.from(booking.startOtpHash, 'hex') : Buffer.alloc(0);
      const supplied = bookingOtpDigest(otp);
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        transaction.update(bookingRef, { startOtpAttempts: attempts + 1, startOtpLastAttemptAt: FieldValue.serverTimestamp() });
        return 'invalid_otp';
      }
      transaction.update(bookingRef, {
        status: 'in_progress',
        startedAt: FieldValue.serverTimestamp(),
        startOtpVerifiedAt: FieldValue.serverTimestamp(),
        startOtpHash: FieldValue.delete(),
        startOtpEncrypted: FieldValue.delete(),
      });
      return 'started';
    });
    if (outcome !== 'started') {
      const status = outcome === 'not_found' || outcome === 'partner_missing' ? 404
        : outcome === 'not_assigned' || outcome === 'partner_unverified' ? 403
        : outcome === 'invalid_otp' ? 401
        : outcome === 'expired' || outcome === 'locked' ? 410 : 409;
      const messages: Record<string, string> = {
        not_found: 'Booking not found.', partner_missing: 'Partner profile not found.',
        not_assigned: 'Only the assigned Channel Partner can start this job.',
        partner_unverified: 'Your Channel Partner account is not verified and active.',
        already_started: 'This job has already started.', bad_status: 'This booking is not ready to start.',
        expired: 'The job-start OTP has expired.', locked: 'Too many incorrect OTP attempts. Contact support.',
        invalid_otp: 'Incorrect OTP. Check with the customer and try again.'
      };
      return res.status(status).json({ success: false, error: messages[outcome] || 'Job could not be started.' });
    }
    return res.json({ success: true, status: 'in_progress' });
  } catch (error) {
    console.error('Secure job start failed:', error);
    return res.status(500).json({ success: false, error: 'Job could not be started securely.' });
  }
});

// Consent-based live location API. Coordinates are server-owned and never exposed
// through direct client Firestore access. Both booking participants must opt in.
const liveLocationStatuses = new Set(['assigned', 'technician_en_route', 'in_progress']);
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
  if (!liveLocationStatuses.has(String(booking.status))) {
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
