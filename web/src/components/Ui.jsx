export const Card = ({ children, className = '' }) => <section className={`bg-white border border-line rounded-lg p-4 mb-4 ${className}`}>{children}</section>;
export const PageHeader = ({ title, sub, children }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-lg font-semibold">{title}</h1>{sub && <p className="text-mute text-sm mt-0.5">{sub}</p>}</div>{children}</div>
);
export const Field = ({ label, children }) => <label className="grid gap-1 text-xs text-mute">{label}{children}</label>;
export const Button = ({ variant = 'primary', className = '', ...p }) => {
  const v = { primary: 'bg-[#3478f6] text-white hover:bg-[#2563eb]', go: 'bg-teal text-white hover:opacity-90', alt: 'bg-white text-ink border border-line hover:bg-canvas' }[variant];
  return <button {...p} className={`rounded-md px-3.5 py-2 text-sm disabled:opacity-50 ${v} ${className}`} />;
};
export const Loading = ({ what = 'ledger' }) => <p className="text-mute text-sm" role="status">Loading {what}…</p>;
export const ErrorBox = ({ error, onRetry }) => (
  <div role="alert" className="rounded-md border border-alert bg-alert-bg text-alert px-3 py-2 text-sm">{error} {onRetry && <button className="underline ml-2" onClick={onRetry}>Retry</button>}</div>
);
export const Empty = ({ children }) => <p className="text-mute text-sm py-2">{children}</p>;
export const Mono = ({ children }) => <span className="font-mono text-xs break-all">{children}</span>;
