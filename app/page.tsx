import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Welcome to Adakaro</h1>
      <p className="text-xl mb-8">Your school fees management system.</p>
      <div className="flex gap-4">
        <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg">
          Parent Login
        </Link>
        <Link href="/dashboard" className="bg-gray-600 text-white px-6 py-3 rounded-lg">
          Admin Dashboard
        </Link>
      </div>
    </main>
  );
}
