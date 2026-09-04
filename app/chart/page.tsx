import { redirect } from "next/navigation";

// The Chart page's content moved to /home (it's now the home page's
// content); this route just forwards anyone with an old link or
// bookmark there.
export default function ChartPageRedirect() {
  redirect("/home");
}
