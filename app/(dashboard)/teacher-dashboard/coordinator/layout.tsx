import { CoordinatorWorkspaceNav } from "./coordinator-workspace-nav";

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <CoordinatorWorkspaceNav />
      {children}
    </div>
  );
}
