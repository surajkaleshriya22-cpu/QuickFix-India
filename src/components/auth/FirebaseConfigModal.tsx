import React, { useState } from 'react';
import { X, Flame, Shield, Key, Copy, Check, Terminal, ExternalLink, Database } from 'lucide-react';

interface FirebaseConfigModalProps {
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'guide' | 'rules' | 'config'>('guide');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleGoogleServicesJson = `{
  "project_info": {
    "project_number": "YOUR_FIREBASE_PROJECT_NUMBER",
    "project_id": "YOUR_FIREBASE_PROJECT_ID",
    "storage_bucket": "YOUR_FIREBASE_PROJECT_ID.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:YOUR_FIREBASE_PROJECT_NUMBER:android:1d9f299ca49d24fd408f78",
        "android_client_info": {
          "package_name": "com.quickfix.app"
        }
      },
      "oauth_client": [],
      "api_key": [
        {
          "current_key": "YOUR_FIREBASE_API_KEY"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      }
    }
  ],
  "configuration_version": "1"
}`;

  const sampleFirestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // STAGING ONLY: deny all client access until server-side authorization,
    // role claims, and emulator tests are implemented and deployed.
    // Do not replace this with client-controlled role fields.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Firebase Authentication & Firestore Architecture</span>
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.2 rounded font-mono">
                  Staging Setup
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Requirements and configurations for native Android APK and Web execution</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-2 flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'guide' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Android Setup Guide
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'rules' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Firestore Staging Rules
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'config' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            google-services.json
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-300 space-y-4">
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="bg-blue-950/60 border border-blue-800/60 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Prerequisites for Phone Authentication (OTP) in India</span>
                </h4>
                <p className="text-slate-300 leading-relaxed text-xs">
                  Firebase Phone Authentication uses reCAPTCHA verification on web and SafetyNet / Play Integrity API on Android. For Android Studio builds:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 pt-1">
                  <li><strong className="text-white">SHA-1 Certificate:</strong> Generate via <code className="text-amber-300 font-mono">./gradlew signingReport</code> and paste in Firebase Console Project Settings.</li>
                  <li><strong className="text-white">Phone Sign-In Provider:</strong> Enable under Firebase Console &gt; Build &gt; Authentication &gt; Sign-in method &gt; Phone.</li>
                  <li><strong className="text-white">Package Name:</strong> Must match <code className="text-amber-300 font-mono">com.quickfix.app</code> declared in <code className="text-slate-400 font-mono">build.gradle.kts</code>.</li>
                  <li><strong className="text-white">Test Numbers:</strong> You can add test phone numbers (e.g. <code className="text-blue-300 font-mono">+91 9845199221</code> with OTP <code className="text-blue-300 font-mono">123456</code>) in the Firebase console for instant sandbox testing without SMS charges.</li>
                </ol>
              </div>

              <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/50 space-y-2">
                <h5 className="font-bold text-white text-xs">Android Gradle Dependencies Configured</h5>
                <pre className="p-3 bg-black/60 rounded-lg font-mono text-[11px] text-emerald-400 overflow-x-auto">
{`// build.gradle.kts (Module: app)
dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
}`}
                </pre>
              </div>

              <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/50 space-y-2">
                <h5 className="font-bold text-white text-xs">Firestore User Document Schema</h5>
                <pre className="p-3 bg-black/60 rounded-lg font-mono text-[11px] text-blue-300 overflow-x-auto">
{`// Document path: /users/{uid}
{
  "uid": "auth_uid_string",
  "phoneNumber": "+91 98451 99221",
  "displayName": "Ananya Deshmukh",
  "email": "ananya.deshmukh@gmail.com",
  "role": "customer", // "customer" | "technician" | "admin"
  "address": "Flat 402, Sai Silver Woods, Koramangala 4th Block",
  "city": "Bengaluru",
  "pincode": "560034",
  "createdAt": "2026-11-03T11:00:00Z"
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Staging deny-all rules — not production RBAC</span>
                <button
                  onClick={() => copyToClipboard(sampleFirestoreRules, 'rules')}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  {copiedKey === 'rules' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'rules' ? 'Copied' : 'Copy staging rules'}</span>
                </button>
              </div>
              <pre className="p-4 bg-black/70 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed">
                <code>{sampleFirestoreRules}</code>
              </pre>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Path: <code className="text-amber-300">android/app/google-services.json</code></span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-600 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>TEMPLATE ONLY — NOT VERIFIED</span>
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(sampleGoogleServicesJson, 'config')}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  {copiedKey === 'config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'config' ? 'Copied' : 'Copy template JSON'}</span>
                </button>
              </div>
              <pre className="p-4 bg-black/70 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed">
                <code>{sampleGoogleServicesJson}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 border-t border-slate-800 px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">QuickFix Architecture Specification v2.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
