import type { Metadata } from "next";
import { HomeLanding } from "@/components/landing/home-landing";

export const metadata: Metadata = {
  title: "Adakaro — Smart school fee management for East Africa",
  description:
    "Simplify payments, track collections, and keep parents happy. Multi-currency fees, ClickPesa payments, and a dashboard built for schools and families.",
  openGraph: {
    title: "Adakaro — Smart school fee management for East Africa",
    description:
      "One platform for schools, parents, and administrators. KES, TZS, UGX, USD. Pay with M-Pesa and more via ClickPesa.",
  },
};

export default function Home() {
  return <HomeLanding />;
}
