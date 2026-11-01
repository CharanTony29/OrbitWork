"use client";

export default function TaskFormCancel() {
  return <button className="button button-secondary" type="button" onClick={(event) => {
    const form = event.currentTarget.form;
    form?.reset();
    const disclosure = event.currentTarget.closest("details");
    if (disclosure) disclosure.open = false;
  }}>Cancel</button>;
}
