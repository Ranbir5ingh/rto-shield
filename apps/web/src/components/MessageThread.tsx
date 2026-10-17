import type { OrderDetail } from '@/lib/types';

const STEPS = ['queued', 'sent', 'delivered', 'read'] as const;

export function MessageThread({
  status,
  conversation,
  draft,
}: {
  status?: OrderDetail['whatsappStatus'];
  conversation?: OrderDetail['conversation'];
  draft?: string;
}) {
  const rank = status && status !== 'failed' ? STEPS.indexOf(status) : -1;
  const thread = conversation ?? [];

  return (
    <div className="border-2 border-ink bg-white">
      <p className="border-b-2 border-ink px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em]">WhatsApp</p>
      <ol className="grid grid-cols-4 border-b-2 border-ink" aria-label="Message status">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={`px-1 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
              index <= rank ? 'bg-lime' : 'bg-paper'
            } ${index > 0 ? 'border-l-2 border-ink' : ''}`}
          >
            {step}
          </li>
        ))}
      </ol>
      {status === 'failed' ? (
        <p className="border-b-2 border-ink bg-hl px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">Failed</p>
      ) : null}
      <div className="space-y-2 p-3">
        {draft ? (
          <p className="border-2 border-dashed border-ink bg-paper px-3 py-2 text-sm leading-6">
            <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-inksoft">Draft</span>
            {draft}
          </p>
        ) : null}
        {thread.map((message, index) => (
          <p
            key={`${message.at}-${index}`}
            className={`max-w-[90%] border-2 border-ink px-3 py-2 text-sm leading-6 ${
              message.direction === 'out' ? 'ml-auto bg-lime/50' : 'bg-white'
            }`}
          >
            <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-inksoft">
              {message.direction === 'out' ? 'Shop' : 'Buyer'} · {message.kind}
            </span>
            {message.text}
          </p>
        ))}
        {!draft && !thread.length ? (
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">No messages yet.</p>
        ) : null}
      </div>
    </div>
  );
}
