import { PageContainer } from "@/components/PageContainer";

export default function BracketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageContainer wide>{children}</PageContainer>;
}
