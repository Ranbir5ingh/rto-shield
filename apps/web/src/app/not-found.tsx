import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <p className="font-mono text-7xl tracking-tight text-accent">404</p>
      <h1 className="mt-4 font-display font-medium text-display-2">That page is not here.</h1>
      <Link href="/" className="btn btn-primary mt-6 w-fit">
        Back home
      </Link>
    </div>
  );
}
