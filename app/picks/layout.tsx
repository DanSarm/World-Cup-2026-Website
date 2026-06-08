import { PageContainer } from "@/components/PageContainer";

export default function PicksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageContainer wide>{children}</PageContainer>;
}
