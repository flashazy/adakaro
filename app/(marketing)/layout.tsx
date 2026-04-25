import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { MarketingHeader } from "@/components/layout/MarketingHeader";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <div
        id="page-content"
        className="flex-1 bg-gray-50 dark:bg-zinc-950"
      >
        {children}
      </div>
      <MarketingFooter />
    </div>
  );
}
