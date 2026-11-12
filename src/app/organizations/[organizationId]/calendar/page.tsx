import AppTopBar from "@/app/AppTopBar";
import BackButton from "@/app/BackButton";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Trash2 } from "lucide-react";
import { createOrganizationHoliday, deleteOrganizationHoliday, reviewLeaveRequest } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import DateInput from "@/app/DateInput";
import CountryHolidayImporter from "./CountryHolidayImporter";
import LeaveRequestFormClient from "./LeaveRequestFormClient";

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

  const extLeaveQuery = await supabase
    .from("leave_requests")
    .select("id, user_id, leave_type, start_date, end_date, request_note, status, review_note, created_at, out_of_office, delegate_user_id, delegated_task_ids, manager_id")
    .eq("organization_id", organizationId)
    .gte("end_date", today)
    .order("start_date")
    .limit(300);

  const leaves: Array<{
    id: string;
    user_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    request_note: string;
    status: string;
    review_note: string;
    created_at: string;
    out_of_office?: boolean;
    delegate_user_id?: string | null;
    delegated_task_ids?: string[] | null;
    manager_id?: string | null;
  }> = extLeaveQuery.error
    ? (await supabase
        .from("leave_requests")
        .select("id, user_id, leave_type, start_date, end_date, request_note, status, review_note, created_at")
        .eq("organization_id", organizationId)
        .gte("end_date", today)
        .order("start_date")
        .limit(300)).data ?? []
    : extLeaveQuery.data ?? [];

  const extMemQuery = await supabase
    .from("organization_members")
    .select("user_id, role, manager_id, status")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const orgMembers: Array<{ user_id: string; role: string; manager_id?: string | null }> = extMemQuery.error
    ? (await supabase
        .from("organization_members")
        .select("user_id, role, status")
        .eq("organization_id", organizationId)
        .eq("status", "active")).data ?? []
    : extMemQuery.data ?? [];

  const [holidayResult, adminResult, reviewerResult] = await Promise.all([
    supabase.from("organization_holidays").select("id, name, holiday_date, location").eq("organization_id", organizationId).gte("holiday_date", today).order("holiday_date").limit(200),
    supabase.rpc("has_org_role", { target_org: organizationId, allowed_roles: ["owner", "admin"] }),
    supabase.rpc("can_review_leave", { target_org: organizationId }),
  ]);

  const holidays = holidayResult.data ?? [];
  const canAdmin = adminResult.data === true;
  const canReviewOrg = reviewerResult.data === true;

  const userIds = [
    ...new Set([
      ...leaves.map((item) => item.user_id),
      ...leaves.map((item) => item.delegate_user_id).filter((id): id is string => Boolean(id)),
      ...leaves.map((item) => item.manager_id).filter((id): id is string => Boolean(id)),
      ...orgMembers.map((m) => m.user_id),
    ]),
  ];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds) : { data: [] };
  const people = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name?.trim() || profile.email || "Teammate"]));

  const myMembership = orgMembers.find((m) => m.user_id === user.id);
  const myImmediateManagerId =
    myMembership?.manager_id && myMembership.manager_id !== user.id
      ? myMembership.manager_id
      : orgMembers.find((m) => m.role === "owner" && m.user_id !== user.id)?.user_id ??
        orgMembers.find((m) => m.role === "admin" && m.user_id !== user.id)?.user_id ??
        null;
  const managerName = myImmediateManagerId ? people.get(myImmediateManagerId) ?? "Reporting Manager" : null;

  const teammates = orgMembers
    .filter((m) => m.user_id !== user.id)
    .map((m) => ({ id: m.user_id, label: people.get(m.user_id) ?? "Teammate" }));

  return (
    <main className="app-shell">
      <AppTopBar email={user.email ?? ""} organizationId={organizationId} />
      <section className="people-calendar-page">
        <BackButton fallbackHref="/dashboard" label="Dashboard" />
        <div className="people-calendar-heading">
          <div>
            <p className="eyebrow">PEOPLE AND AVAILABILITY</p>
            <h1>{organization.name} calendar</h1>
            <p className="muted">
              Company holidays and employee leave requests.{" "}
              <Link href={`/organizations/${organizationId}/members`} style={{ color: "var(--green)", fontWeight: 700 }}>
                Manage Organization Hierarchy →
              </Link>
            </p>
          </div>
          <CalendarDays size={24} />
        </div>
        {error && (
          <p className="error" role="alert">
            That calendar action could not be completed. Check your role and the form fields.
          </p>
        )}
        <div className="people-calendar-grid">
          <section className="people-calendar-card">
            <header>
              <div>
                <p className="eyebrow">UPCOMING</p>
                <h2>Holidays</h2>
              </div>
            </header>
            {canAdmin && <CountryHolidayImporter organizationId={organizationId} initialCountryCode={countryCode} />}
            {holidays.length ? (
              holidays.map((holiday) => (
                <div className="calendar-event-row" key={holiday.id}>
                  <time>
                    {new Date(`${holiday.holiday_date}T00:00:00Z`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </time>
                  <strong>{holiday.name}</strong>
                  <span>{holiday.location || "All locations"}</span>
                  {canAdmin && (
                    <form action={deleteOrganizationHoliday}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="holidayId" value={holiday.id} />
                      <button
                        className="calendar-event-delete"
                        title={`Remove ${holiday.name}`}
                        aria-label={`Remove ${holiday.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <p className="muted small">No upcoming holidays have been added.</p>
            )}
            {canAdmin && (
              <form action={createOrganizationHoliday} className="people-calendar-form">
                <input type="hidden" name="organizationId" value={organizationId} />
                <label>
                  Holiday name
                  <input name="name" maxLength={120} required placeholder="Holiday name" />
                </label>
                <label>
                  Date
                  <DateInput name="holidayDate" min={today} required />
                </label>
                <label>
                  Location / team
                  <input name="location" maxLength={120} placeholder="Optional" />
                </label>
                <button className="mini-save">Add holiday</button>
              </form>
            )}
          </section>

          <section className="people-calendar-card">
            <header>
              <div>
                <p className="eyebrow">REQUEST TIME OFF</p>
                <h2>Leave request</h2>
              </div>
            </header>
            <LeaveRequestFormClient
              organizationId={organizationId}
              today={today}
              managerName={managerName}
              teammates={teammates}
            />
          </section>
        </div>

        <section className="leave-requests-section">
          <header>
            <div>
              <p className="eyebrow">TEAM AVAILABILITY</p>
              <h2>
                Leave requests <span className="count-pill">{leaves.length}</span>
              </h2>
            </div>
          </header>
          {leaves.length ? (
            leaves.map((request) => {
              const requesterMembership = orgMembers.find((m) => m.user_id === request.user_id);
              const isImmediateManager =
                request.manager_id === user.id || requesterMembership?.manager_id === user.id;
              const canReviewThis = canReviewOrg || isImmediateManager;
              const managerLabel = request.manager_id
                ? people.get(request.manager_id)
                : requesterMembership?.manager_id
                  ? people.get(requesterMembership.manager_id)
                  : null;
              const delegateLabel = request.delegate_user_id ? people.get(request.delegate_user_id) : null;
              const delegatedCount = Array.isArray(request.delegated_task_ids) ? request.delegated_task_ids.length : 0;

              return (
                <article className="leave-request-card" key={request.id}>
                  <div className="leave-request-head">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong>{people.get(request.user_id) ?? "Teammate"}</strong>
                      {request.out_of_office && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "999px",
                            background: "rgba(37, 99, 235, 0.12)",
                            color: "#2563eb",
                          }}
                        >
                          Out of Office
                        </span>
                      )}
                      {managerLabel && (
                        <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                          Approver: {managerLabel}
                        </span>
                      )}
                    </div>
                    <span className={`timesheet-status state-${request.status}`}>{request.status}</span>
                  </div>
                  <p>
                    {request.leave_type} · {new Date(`${request.start_date}T00:00:00Z`).toLocaleDateString()} –{" "}
                    {new Date(`${request.end_date}T00:00:00Z`).toLocaleDateString()}
                  </p>
                  {delegateLabel && (
                    <p style={{ color: "#b45309", fontWeight: 600 }}>
                      Delegated {delegatedCount} urgent/high priority task{delegatedCount === 1 ? "" : "s"} to {delegateLabel}
                    </p>
                  )}
                  {request.request_note && <p>{request.request_note}</p>}
                  {request.review_note && <p className="muted small">Review note: {request.review_note}</p>}
                  {canReviewThis && request.status === "pending" && (
                    <form action={reviewLeaveRequest} className="leave-review-form">
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <input name="note" maxLength={2000} placeholder="Required when rejecting" />
                      <button className="mini-save" name="decision" value="approved">
                        Approve
                      </button>
                      <button className="mini-remove" name="decision" value="rejected">
                        Reject
                      </button>
                    </form>
                  )}
                </article>
              );
            })
          ) : (
            <p className="muted small">No upcoming or pending leave requests.</p>
          )}
        </section>
      </section>
    </main>
  );
}
