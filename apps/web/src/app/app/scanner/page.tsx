import { redirect } from 'next/navigation';

export default function ScannerRedirect() {
  redirect('/app/orders');
}
