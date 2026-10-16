'use client';

import { useMemo } from 'react';

const TOKENS = [
  'S1042 · ₹2,458 · COD · 110001',
  'S1043 · ₹899 · PREPAID · 400002',
  'S1044 · ₹1,599 · COD · 110045',
  'RTO RISK · FLAGGED',
  'S1045 · ₹3,199 · COD · 122001',
  'S1046 · ₹749 · COD · 560001',
  'ADDRESS: INCOMPLETE',
  'S1047 · ₹2,099 · PREPAID · 110096',
  'S1048 · ₹1,299 · COD · 400050',
  'GHOST BUYER · 3 RTO',
  'S1049 · ₹4,599 · COD · 122018',
  'S1050 · ₹999 · COD · 110008',
  'PINCODE: 110045 · OK',
  'S1051 · ₹1,899 · PREPAID · 560034',
  'S1052 · ₹2,799 · COD · 400001',
  'FAKE ADDRESS · FLAGGED',
  'S1053 · ₹649 · COD · 110002',
  'S1054 · ₹5,199 · COD · 122001',
  'REPEAT BUYER · CLEAR',
  'S1055 · ₹1,099 · PREPAID · 110015',
];

export function OrderRain({ columns = 8 }: { columns?: number }) {
  const cols = useMemo(() => {
    const out: string[][] = [];
    for (let c = 0; c < columns; c++) {
      const col: string[] = [];
      for (let r = 0; r < 14; r++) {
        col.push(TOKENS[(c * 7 + r * 3) % TOKENS.length]);
      }
      out.push(col);
    }
    return out;
  }, [columns]);

  return (
    <div className="order-rain" aria-hidden="true">
      <div className="order-rain-inner">
        {cols.map((col, i) => (
          <div key={i} className="order-rain-col">
            {col.map((t, j) => (
              <span key={j}>{t}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
