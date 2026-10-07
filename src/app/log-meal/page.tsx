import { getDiningProvider } from "@/services";
import LogMealClient from "./LogMealClient";

export default async function LogMealPage() {
  const menuItems = await getDiningProvider().getMenuItems();
  const campusAvailable = menuItems.some((item) => item.provenance.dataStatus === "verified");
  return <LogMealClient menuItems={menuItems} campusAvailable={campusAvailable} />;
}
