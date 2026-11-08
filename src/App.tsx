/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QuickFixProvider, useQuickFix } from './context/QuickFixContext';
import { AndroidFrame } from './components/AndroidFrame';
import { CustomerHome } from './components/customer/CustomerHome';
import { TechnicianPortal } from './components/technician/TechnicianPortal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLoginScreen } from './components/admin/AdminLoginScreen';
import { KotlinCodeViewer } from './components/codeview/KotlinCodeViewer';
import { FirebaseConfigModal } from './components/auth/FirebaseConfigModal';
import { AuthModal } from './components/auth/AuthModal';
import { UserProfileDrawer } from './components/auth/UserProfileDrawer';
import { isAuthorizedAdminEmail } from './types';

const AppContent: React.FC = () => {
  const {
    activeRole,
    currentUser,
    showCodeInspector,
    setShowCodeInspector,
    showFirebaseConfig,
    setShowFirebaseConfig,
    showAuthModal,
    setShowAuthModal,
    showProfileDrawer,
    setShowProfileDrawer
  } = useQuickFix();

  return (
    <>
      <AndroidFrame>
        {activeRole === 'customer' && <CustomerHome />}
        {activeRole === 'technician' && <TechnicianPortal />}
        {activeRole === 'admin' && (
          currentUser?.role === 'admin' && isAuthorizedAdminEmail(currentUser.email) ? (
            <AdminDashboard />
          ) : (
            <AdminLoginScreen />
          )
        )}
      </AndroidFrame>

      {/* Code Inspector */}
      {showCodeInspector && (
        <KotlinCodeViewer onClose={() => setShowCodeInspector(false)} />
      )}

      {/* Firebase Setup & Config Guide */}
      {showFirebaseConfig && (
        <FirebaseConfigModal onClose={() => setShowFirebaseConfig(false)} />
      )}

      {/* Authentication Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* User Profile & Address Drawer */}
      {showProfileDrawer && (
        <UserProfileDrawer
          onClose={() => setShowProfileDrawer(false)}
          onOpenAuth={() => {
            setShowProfileDrawer(false);
            setShowAuthModal(true);
          }}
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <QuickFixProvider>
      <AppContent />
    </QuickFixProvider>
  );
}
