import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function updatePassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (password.length < 8 || password.length > 128) redirect("/auth/reset-password?error=invalid_password");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/reset-password?error=reset_failed");
  redirect("/dashboard?message=password_updated");
}

export default function ResetPasswordPage() {
  return <main className="auth-shell"><section className="auth-card"><Link className="brand" href="/">Orbit<span>work</span></Link><h1>Set a new password</h1><form action={updatePassword} className="form-stack"><label>New password<input name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" /></label><button className="button button-primary">Update password</button></form></section></main>;
}
