import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20">
      <h1 className="font-medium text-display-2">That page is not here.</h1>
      <Link href="/" className="mt-6 inline-block font-medium underline">
        Back home
      </Link>
    </div>
  );
}
