import React from 'react';
import { AuthModal } from '../auth/AuthModal';

interface CustomerAuthModalProps {
  onClose: () => void;
}

/**
 * Keep the customer-home entry point on the same Firebase Phone Auth flow
 * used by the primary authentication modal. Never create a local/mock session
 * after an unverified code or bypass Firebase credential confirmation.
 */
export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({ onClose }) => (
  <AuthModal initialRole="customer" onClose={onClose} />
);
