import { Redirect } from "expo-router";
import { getSession } from "../lib/session";

// Entry point: signed out → Welcome, first sign-in → Role, otherwise → Home tab.
export default function Index() {
  const session = getSession();
  if (!session) return <Redirect href="/welcome" />;
  if (!session.role) return <Redirect href="/role" />;
  return <Redirect href="/home" />;
}
