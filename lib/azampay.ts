/**
 * AzamPay API service for mobile money checkout.
 * Uses client credentials for token, then MNO checkout endpoint.
 */

import axios from "axios";

const AUTH_SANDBOX = "https://authenticator-sandbox.azampay.co.tz";
const AUTH_LIVE = "https://authenticator.azampay.co.tz";
const CHECKOUT_SANDBOX = "https://sandbox.azampay.co.tz";
const CHECKOUT_LIVE = "https://checkout.azampay.co.tz";

export type AzamPayProvider =
  | "Airtel"
  | "Tigo"
  | "Halopesa"
  | "Azampesa"
  | "Mpesa";

export interface AzamPayTokenResponse {
  success: boolean;
  data?: { accessToken: string; expire: string };
  message?: string;
  statusCode?: number;
}

export interface AzamPayCheckoutResponse {
  success: boolean;
  transactionId?: string;
  msg?: string;
  message?: string;
  statusCode?: number;
}

export interface AzamPayCheckoutParams {
  accountNumber: string;
  amount: number;
  currency?: string;
  externalId: string;
  provider?: AzamPayProvider;
}

function getAuthUrl(): string {
  const base = process.env.AZAMPAY_BASE_URL ?? "";
  return base.includes("sandbox") ? AUTH_SANDBOX : AUTH_LIVE;
}

function getCheckoutUrl(): string {
  const base = process.env.AZAMPAY_BASE_URL ?? "";
  return base.includes("sandbox") ? CHECKOUT_SANDBOX : CHECKOUT_LIVE;
}

/**
 * Get access token using client credentials.
 */
export async function getAzamPayToken(): Promise<string> {
  const clientId = process.env.AZAMPAY_CLIENT_ID;
  const clientSecret = process.env.AZAMPAY_CLIENT_SECRET;
  const appName = process.env.AZAMPAY_APP_NAME ?? "azampay";

  if (!clientId || !clientSecret) {
    throw new Error("AZAMPAY_CLIENT_ID and AZAMPAY_CLIENT_SECRET are required");
  }

  const authUrl = getAuthUrl();
  const tokenPayload = { appName, clientId, clientSecret };
  console.log("[getAzamPayToken] request payload:", JSON.stringify({ appName, clientId, clientSecret: "[REDACTED]" }, null, 2));

  try {
    const response = await axios.post<AzamPayTokenResponse>(
      `${authUrl}/AppRegistration/GenerateToken`,
      tokenPayload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("[getAzamPayToken] response status:", response.status);
    console.log("[getAzamPayToken] response data:", JSON.stringify(response.data, null, 2));
    const { data } = response;

    if (!data?.success || !data.data?.accessToken) {
      throw new Error(
        (data as { message?: string })?.message ?? "Failed to get AzamPay token"
      );
    }

    return data.data.accessToken;
  } catch (err) {
    const axiosErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error("[getAzamPayToken] error:", axiosErr.message);
    if (axiosErr.response) {
      console.error("[getAzamPayToken] response status:", axiosErr.response.status);
      console.error("[getAzamPayToken] response data:", JSON.stringify(axiosErr.response.data, null, 2));
    }
    throw err;
  }
}

/**
 * Initiate mobile money payment via AzamPay MNO checkout.
 */
export async function initiateAzamPayCheckout(
  params: AzamPayCheckoutParams
): Promise<AzamPayCheckoutResponse> {
  const apiKey = process.env.AZAMPAY_API_KEY;
  if (!apiKey) {
    throw new Error("AZAMPAY_API_KEY is required");
  }

  const token = await getAzamPayToken();
  const checkoutUrl = getCheckoutUrl();

  const body = {
    accountNumber: params.accountNumber,
    amount: String(params.amount),
    currency: params.currency ?? "TZS",
    externalId: params.externalId,
    provider: params.provider ?? "Mpesa",
  };
  console.log("[initiateAzamPayCheckout] request payload:", JSON.stringify(body, null, 2));

  try {
    const response = await axios.post<AzamPayCheckoutResponse>(
      `${checkoutUrl}/azampay/mno/checkout`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-API-Key": apiKey,
        },
      }
    );
    console.log("[initiateAzamPayCheckout] response status:", response.status);
    console.log("[initiateAzamPayCheckout] response data:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (err) {
    const axiosErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error("[initiateAzamPayCheckout] error:", axiosErr.message);
    if (axiosErr.response) {
      console.error("[initiateAzamPayCheckout] response status:", axiosErr.response.status);
      console.error("[initiateAzamPayCheckout] response data:", JSON.stringify(axiosErr.response.data, null, 2));
    }
    throw err;
  }
}
