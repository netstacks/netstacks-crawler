import { useState, useEffect, useRef } from 'react';

interface Props {
  value: string;
  onSave: (next: string) => void;
  editing: boolean;
  onCancel: () => void;
}

export function InlineEdit({ value, onSave, editing, onCancel }: Props) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setV(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  if (!editing) return <span>{value}</span>;
  return (
    <input
      ref={ref}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(v);
        if (e.key === 'Escape') { setV(value); onCancel(); }
      }}
      onBlur={() => { setV(value); onCancel(); }}
      className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border-active)] rounded px-1 text-[13px] w-full"
      data-testid="inline-edit-input"
    />
  );
}
