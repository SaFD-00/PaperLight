/** 컬렉션 이름 인라인 입력(생성·이름변경 공용). Enter=확정, Esc/blur=취소·확정. */
export function InlineNameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  ariaLabel: string;
  className: string;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
        if (e.key === "Escape") onCancel();
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
