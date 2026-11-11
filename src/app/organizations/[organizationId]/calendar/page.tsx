import AppTopBar from "@/app/AppTopBar";
import BackButton from "@/app/BackButton";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Trash2 } from "lucide-react";
import { createLeaveRequest, createOrganizationHoliday, deleteOrganizationHoliday, reviewLeaveRequest } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import DateInput from "@/app/DateInput";
import CountryHolidayImporter from "./CountryHolidayImporter";

export default async function OrganizationCalendarPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { organizationId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: orgWithCountry, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, country_code")
    .eq("id", organizationId)
    .maybeSingle();
  const organization = orgErr
    ? (await supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle()).data
    : orgWithCountry;
  if (!organization) notFound();
  const countryCode =
    orgWithCountry && "country_code" in orgWithCountry
      ? (orgWithCountry.country_code as string | null)
      : null;
  const today = new Date().toISOString().slice(0, 10);
  const [holidayResult, leaveResult, adminResult, reviewerResult] = await Promise.all([
    supabase.from("organization_holidays").select("id, name, holiday_date, location").eq("organization_id", organizationId).gte("holiday_date", today).order("holiday_date").limit(200),
    supabase.from("leave_requests").select("id, user_id, leave_type, start_date, end_date, request_note, status, review_note, created_at").eq("organization_id", organizationId).gte("end_date", today).order("start_date").limit(300),
    supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner", "admin"] }),
    supabase.rpc("can_review_leave", { target_org: organizationId }),
  ]);
  const holidays = holidayResult.data ?? [];
  const leaves = leaveResult.data ?? [];
  const canAdmin = adminResult.data === true;
  const canReview = reviewerResult.data === true;
  const userIds = [...new Set(leaves.map((item) => item.user_id))];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds) : { data: [] };
  const people = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Teammate"]));
  return <main className="app-shell"><AppTopBar email={user.email ?? ""} /><section className="people-calendar-page"><BackButton fallbackHref="/dashboard" label="Dashboard"/><div className="people-calendar-heading"><div><p className="eyebrow">PEOPLE AND AVAILABILITY</p><h1>{organization.name} calendar</h1><p className="muted">Company holidays and employee leave requests.</p></div><CalendarDays size={24}/></div>{error && <p className="error" role="alert">That calendar action could not be completed. Check your role and the form fields.</p>}<div className="people-calendar-grid"><section className="people-calendar-card"><header><div><p className="eyebrow">UPCOMING</p><h2>Holidays</h2></div></header>{canAdmin && <CountryHolidayImporter organizationId={organizationId} initialCountryCode={countryCode} />}{holidays.length ? holidays.map((holiday) => <div className="calendar-event-row" key={holiday.id}><time>{new Date(`${holiday.holiday_date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}</time><strong>{holiday.name}</strong><span>{holiday.location || "All locations"}</span>{canAdmin && <form action={deleteOrganizationHoliday}><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="holidayId" value={holiday.id}/><button className="calendar-event-delete" title={`Remove ${holiday.name}`} aria-label={`Remove ${holiday.name}`}><Trash2 size={13}/></button></form>}</div>) : <p className="muted small">No upcoming holidays have been added.</p>}{canAdmin && <form action={createOrganizationHoliday} className="people-calendar-form"><input type="hidden" name="organizationId" value={organizationId}/><label>Holiday name<input name="name" maxLength={120} required placeholder="Holiday name"/></label><label>Date<DateInput name="holidayDate" min={today} required/></label><label>Location / team<input name="location" maxLength={120} placeholder="Optional"/></label><button className="mini-save">Add holiday</button></form>}</section><section className="people-calendar-card"><header><div><p className="eyebrow">REQUEST TIME OFF</p><h2>Leave request</h2></div></header><form action={createLeaveRequest} className="people-calendar-form"><input type="hidden" name="organizationId" value={organizationId}/><label>Leave type<select name="leaveType" defaultValue="vacation"><option value="vacation">Vacation</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="other">Other</option></select></label><div className="form-two-col"><label>From<DateInput name="startDate" min={today} required/></label><label>Through<DateInput name="endDate" min={today} required/></label></div><label>Note<textarea name="note" maxLength={2000} placeholder="Optional context"/></label><button className="button button-primary">Request leave</button></form></section></div><section className="leave-requests-section"><header><div><p className="eyebrow">TEAM AVAILABILITY</p><h2>Leave requests <span className="count-pill">{leaves.length}</span></h2></div></header>{leaves.length ? leaves.map((request) => <article className="leave-request-card" key={request.id}><div className="leave-request-head"><strong>{people.get(request.user_id) ?? "Teammate"}</strong><span className={`timesheet-status state-${request.status}`}>{request.status}</span></div><p>{request.leave_type} · {new Date(`${request.start_date}T00:00:00Z`).toLocaleDateString()} – {new Date(`${request.end_date}T00:00:00Z`).toLocaleDateString()}</p>{request.request_note && <p>{request.request_note}</p>}{request.review_note && <p className="muted small">Review note: {request.review_note}</p>}{canReview && request.status === "pending" && <form action={reviewLeaveRequest} className="leave-review-form"><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="requestId" value={request.id}/><input name="note" maxLength={2000} placeholder="Required when rejecting"/><button className="mini-save" name="decision" value="approved">Approve</button><button className="mini-remove" name="decision" value="rejected">Reject</button></form>}</article>) : <p className="muted small">No upcoming or pending leave requests.</p>}</section></section></main>;
}
