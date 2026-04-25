import type { Metadata } from "next";
import { HomeLanding } from "@/components/landing/home-landing";

export const metadata: Metadata = {
  title: "Adakaro — A simple system to run your entire school",
  description:
    "Manage fees, students, classes, teachers, report cards, and parent communication in one place. Built for real schools.",
  openGraph: {
    title: "Adakaro — Run your school without paperwork or confusion",
    description:
      "One simple system for fees, students, reports, and daily operations — built for schools in Africa.",
  },
};

export default function Home() {
  return <HomeLanding />;
}
