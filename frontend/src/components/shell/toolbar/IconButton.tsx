/** 툴바 공용 아이콘 버튼(라벨=title+aria-label). */
export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
    >
      {children}
    </button>
  );
}
