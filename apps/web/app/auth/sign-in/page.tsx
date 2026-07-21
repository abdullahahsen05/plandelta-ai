import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = next?.startsWith("/app") && !next.startsWith("//") ? next : "/app";
  redirect(`/auth/guest?next=${encodeURIComponent(destination)}`);
}
