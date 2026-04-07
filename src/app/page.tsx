import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
      <h1 className="text-3xl font-bold">AIdCast</h1>

      <p className="text-center max-w-md">
        AI-powered mutual aid app connecting people who need help with those who can offer it.
      </p>

      <div className="flex gap-4">
        <a href="/submit" className="px-4 py-2 bg-black text-white rounded">
          Submit
        </a>

        <a href="/board" className="px-4 py-2 border rounded">
          View Board
        </a>
      </div>
    </main>
  );
}