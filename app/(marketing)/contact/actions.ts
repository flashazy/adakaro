"use server";

export interface ContactFormState {
  ok?: boolean;
  error?: string;
}

/**
 * Handles public contact form submissions. Logs payload for ops; replace with
 * Resend/SendGrid/etc. when ready. Intended recipient: info@adakaro.com
 */
export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!fullName) {
    return { error: "Please enter your full name." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!subject) {
    return { error: "Please enter a subject." };
  }
  if (message.length < 10) {
    return {
      error: "Please enter a message (at least 10 characters).",
    };
  }

  const payload = {
    fullName,
    email,
    subject,
    message,
    intendedRecipient: "info@adakaro.com",
    receivedAt: new Date().toISOString(),
  };

  console.log("[contact-form]", JSON.stringify(payload, null, 2));

  return { ok: true };
}
