'use client';

import { useEffect, useState } from 'react';
import { getContactInfo, telLink, whatsappLink, type ContactInfo } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

let cache: ContactInfo | null = null;

/**
 * "Need help? WhatsApp us · Call us" — shown where people get stuck.
 * Reads the numbers from Admin → Plans → Contact details; shows nothing until they're filled in.
 */
export function HelpLine({ title = 'Need help?', topic = '', compact = false }: { title?: string; topic?: string; compact?: boolean }) {
  const [c, setC] = useState<ContactInfo | null>(cache);
  useEffect(() => {
    if (cache) return;
    getContactInfo(browserClient()).then((x) => { cache = x; setC(x); }).catch(() => {});
  }, []);
  if (!c || (!c.whatsapp && !c.phone && !c.email)) return null;
  const msg = `Hello GLE Movies, I need help${topic ? ` with ${topic}` : ''}: `;
  return (
    <div className={`helpline${compact ? ' compact' : ''}`}>
      <span className="helpline-title">{title}</span>
      {c.whatsapp && <a href={whatsappLink(c.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="helpline-btn wa">WhatsApp us</a>}
      {c.phone && <a href={telLink(c.phone)} className="helpline-btn">Call {c.phone}</a>}
      {c.email && !compact && <a href={`mailto:${c.email}`} className="helpline-btn">Email</a>}
    </div>
  );
}
