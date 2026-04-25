import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Adakaro",
  description:
    "Simple per-student pricing for schools. Start free with up to 20 students, then pay only for what you use.",
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
