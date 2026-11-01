import Link from "next/link";
import CurrentUserBadge from "@/app/CurrentUserBadge";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { markNotificationsRead, signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: notifications } = await supabase.from("notifications").select("id, actor_id, project_id, task_id, event_type, message, created_at, read_at").order("created_at", { ascending: false }).limit(100);
  const actorIds = [...new Set((notifications ?? []).map((item) => item.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = actorIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", actorIds) : { data: [] };
  const actorNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "A teammate"]));
  const unreadCount = (notifications ?? []).filter((item) => !item.read_at).length;

  return <main className="app-shell"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">O</span>Orbit<span>work</span></Link><div className="topbar-right"><CurrentUserBadge email={user.email ?? ""}/><form action={signOut}><button className="quiet-button">Sign out</button></form></div></header><section className="inbox-page"><Link className="back-link" href="/dashboard"><ArrowLeft size={15}/> Dashboard</Link><div className="inbox-heading"><div><p className="eyebrow">YOUR SPACE</p><h1>Inbox <span className="count-pill">{unreadCount} unread</span></h1><p className="muted">Task assignment, status, and discussion updates.</p></div>{unreadCount > 0 && <form action={markNotificationsRead}><button className="button button-secondary">Mark all read</button></form>}</div><div className="inbox-list">{notifications?.length ? notifications.map((item) => <article className={`inbox-item${item.read_at ? " read" : " unread"}`} key={item.id}><span className="inbox-icon"><Bell size={16}/></span><div className="inbox-copy"><p><strong>{item.actor_id ? actorNames.get(item.actor_id) ?? "A teammate" : "Orbitwork"}</strong> · {item.message}</p><time>{new Date(item.created_at).toLocaleString()}</time></div>{item.task_id && <Link className="discussion-link" href={`/projects/${item.project_id}/tasks/${item.task_id}`}>Open task</Link>}</article>) : <div className="empty-tasks"><h3>You’re all caught up</h3><p>Updates about assigned tasks will appear here.</p></div>}</div></section></main>;
}
