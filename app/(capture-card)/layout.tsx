import { Toaster } from "sonner";

export const runtime = "nodejs";

export default function CaptureCardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Toaster richColors position="top-center" />
    </>
  );
}
