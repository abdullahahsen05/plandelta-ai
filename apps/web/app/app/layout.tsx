import { AppHeader } from "../../components/app-header";

export default function ApplicationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-[#F3F0E8]">
      <AppHeader />
      {children}
    </div>
  );
}
