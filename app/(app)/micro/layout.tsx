import { OngletsMicro } from "./onglets";

export default function MicroLayout({ children }: LayoutProps<"/micro">) {
  return (
    <>
      <OngletsMicro />
      {children}
    </>
  );
}
