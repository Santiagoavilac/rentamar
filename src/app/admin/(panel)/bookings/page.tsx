import { redirect } from "next/navigation";

export default function BookingsPage() {
  redirect("/admin/calendar?view=list");
}
