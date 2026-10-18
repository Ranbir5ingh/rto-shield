'use client';

import { useEffect, useState } from 'react';
import { CircleHelp, Compass, FlaskConical, LogIn, Rocket, Rows3, Tag } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Dock, type DockItem } from '@/components/Dock';

const sections = [
  { id: 'gap', href: '/#gap', label: 'Problem', short: 'Why', icon: Compass },
  { id: 'chapters', href: '/#chapters', label: 'Autopilot', short: 'Auto', icon: Rows3 },
  { id: 'model', href: '/#model', label: 'Score', short: 'Score', icon: FlaskConical },
  { id: 'pricing', href: '/#pricing', label: 'Go live', short: 'Live', icon: Tag },
  { id: 'faq', href: '/#faq', label: 'FAQ', short: 'FAQ', icon: CircleHelp },
] as const;

export function SiteHeader() {
  const [hash, setHash] = useState('');
  const [path, setPath] = useState('');

  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      setPath(window.location.pathname);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const items: DockItem[] = [
    {
      id: 'home',
      href: '/',
      label: 'RTO Shield',
      short: 'RTO',
      current: path === '/' && !hash,
      mark: <LogoMark size={22} />,
      onSelect: () => {
        setHash('');
        setPath('/');
      },
    },
    ...sections.map((section) => ({
      id: section.id,
      href: section.href,
      label: section.label,
      short: section.short,
      icon: section.icon,
      current: hash === `#${section.id}`,
      onSelect: () => setHash(`#${section.id}`),
    })),
    {
      id: 'login',
      href: '/login',
      label: 'Log in',
      short: 'In',
      icon: LogIn,
      current: path === '/login',
    },
    {
      id: 'signup',
      href: '/signup',
      label: 'Get started',
      short: 'Go',
      icon: Rocket,
      current: path === '/signup',
    },
  ];

  return <Dock items={items} label="Primary" placement="responsive" />;
}
