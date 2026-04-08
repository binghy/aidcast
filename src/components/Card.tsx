type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/40 bg-white/85 shadow-lg backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}