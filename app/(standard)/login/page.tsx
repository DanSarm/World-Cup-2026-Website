import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { teamsForPicker } from "@/lib/teamsData";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return <LoginForm teams={teamsForPicker()} isRegister />;
}
