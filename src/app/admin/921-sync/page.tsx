import { auth, isAdminSession } from "@/auth";
import { canPublish921Snapshot } from "@/services/admin921SyncEnvironment";
import { redirect } from "next/navigation";
import SyncClient from "./SyncClient";
import "./sync.css";

export const metadata = {
  title: "921 Daily Sync · Falcon Fuel",
};

export default async function Daily921SyncPage() {
  const session = await auth();
  if (!isAdminSession(session)) redirect("/admin/sign-in");
  return <SyncClient publishingEnabled={canPublish921Snapshot()} />;
}
