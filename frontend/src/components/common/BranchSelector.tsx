import React from 'react';

interface BranchSelectorProps {
  variant?: 'navbar' | 'hub' | 'card';
  className?: string;
  onChangeBranch?: (branchId: string | null) => void;
}

/**
 * BranchSelector - Single restaurant branch mode
 * Multi-branch switching is disabled; returns null to hide branch pickers throughout the UI.
 */
export const BranchSelector: React.FC<BranchSelectorProps> = () => {
  return null;
};
