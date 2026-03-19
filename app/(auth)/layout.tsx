export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Adakaro
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            School Fee Management
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
