"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ContactWhatsAppModal } from "./contact-whatsapp-modal";

interface ContactWhatsAppContextValue {
  openWhatsAppModal: () => void;
  modalOpen: boolean;
}

const ContactWhatsAppContext = createContext<ContactWhatsAppContextValue | null>(
  null
);

export function ContactWhatsAppProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openWhatsAppModal = useCallback(() => setOpen(true), []);
  const closeWhatsAppModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openWhatsAppModal, modalOpen: open }),
    [openWhatsAppModal, open]
  );

  return (
    <ContactWhatsAppContext.Provider value={value}>
      {children}
      <ContactWhatsAppModal open={open} onClose={closeWhatsAppModal} />
    </ContactWhatsAppContext.Provider>
  );
}

export function useContactWhatsApp(): ContactWhatsAppContextValue {
  const ctx = useContext(ContactWhatsAppContext);
  if (!ctx) {
    throw new Error(
      "useContactWhatsApp must be used within ContactWhatsAppProvider"
    );
  }
  return ctx;
}
