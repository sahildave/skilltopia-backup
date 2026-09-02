import { createContext, useCallback, useContext } from 'react';

export const SkillDetailDialogCloseContext = createContext<(() => void) | null>(null);

/**
 * Closes the enclosing skill-detail dialog. Returns a no-op outside one, so shared
 * card actions can call it whether or not they're rendered inside the dialog.
 */
export function useSkillDetailDialogClose() {
  const close = useContext(SkillDetailDialogCloseContext);
  return useCallback(() => close?.(), [close]);
}
