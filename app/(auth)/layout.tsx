import { MinimalHeader } from "@/components/layout/MinimalHeader";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900">
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <MinimalHeader />
      <div
        id="page-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
