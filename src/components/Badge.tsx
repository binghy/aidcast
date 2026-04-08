type BadgeProps = {
  children: React.ReactNode;
  variant?:
    | "default"
    | "request"
    | "offer"
    | "high"
    | "medium"
    | "low"
    | "open"
    | "closed";
};

export default function Badge({
  children,
  variant = "default",
}: BadgeProps) {
  const styles: Record<string, string> = {
    default: "bg-zinc-100 text-zinc-700 border-zinc-200",

    request: "bg-blue-100 text-blue-700 border-blue-200",
    offer: "bg-violet-100 text-violet-700 border-violet-200",

    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-sky-100 text-sky-700 border-sky-200",

    open: "bg-green-100 text-green-700 border-green-200",
    closed: "bg-rose-100 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}