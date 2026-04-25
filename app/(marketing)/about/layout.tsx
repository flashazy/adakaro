import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Adakaro",
  description:
    "What Adakaro is, why we built it, and how we help schools manage fees, students, and communication with clarity.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
