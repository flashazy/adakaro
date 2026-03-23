/**
 * Full-bleed wrapper so the setup screen stays centered on the viewport
 * while the parent (dashboard) group uses a max-width content column.
 */
export default function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-[100vw] px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
