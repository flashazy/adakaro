import type { Metadata } from "next";
import { HomeLanding } from "@/components/landing/home-landing";

export const metadata: Metadata = {
  title: "Adakaro — Track every school fee without paper or confusion",
  description:
    "Adakaro helps schools in Tanzania and East Africa collect fees, generate control numbers, and instantly see who has paid — all in one simple system.",
  openGraph: {
    title: "Adakaro — School fee tracking for Tanzania & East Africa",
    description:
      "School fee tracking for Tanzania and East Africa. Control numbers, mobile money, and clear visibility of who has paid.",
  },
};

export default function Home() {
  return <HomeLanding />;
}
