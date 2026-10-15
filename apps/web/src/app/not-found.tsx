import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20">
      <h1 className="font-display text-5xl">That page is not on the packing table.</h1>
      <Link href="/" className="mt-6 inline-block font-semibold text-saffron">
        Back home
      </Link>
    </div>
  );
}
