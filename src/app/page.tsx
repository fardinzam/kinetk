import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Kinetk</h1>
      <p>Local-first webhook workflow builder for developers.</p>
      <Link href="/workflows">Open workflows</Link>
    </main>
  );
}
