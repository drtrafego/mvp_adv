import { Sidebar } from "@/components/sidebar";
import { exigirLogin } from "@/lib/auth";

export default async function AppLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  const usuario = await exigirLogin();

  return (
    <Sidebar usuario={usuario}>
      {children}
      {modal}
    </Sidebar>
  );
}
