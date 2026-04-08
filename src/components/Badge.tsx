type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "request" | "offer" | "high" | "medium" | "low" | "open" | "closed";
};

export default function Badge({ children, variant = "default" }: BadgeProps) {
  const styles: Record<string, string> = {
    default: "bg-gray-100 text-gray-700 border-gray-200",
    request: "bg-blue-50 text-blue-700 border-blue-200",
    offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-gray-50 text-gray-600 border-gray-200",
    open: "bg-green-50 text-green-700 border-green-200",
    closed: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}