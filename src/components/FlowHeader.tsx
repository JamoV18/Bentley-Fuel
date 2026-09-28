import Link from "next/link";
import AppNav from "./AppNav";

export default function FlowHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return <>
    <div className="flow-header"><Link href={backHref}><span aria-hidden="true">← </span>{backLabel}</Link></div>
    <AppNav showDailyMealCheckin={false} showContextPrompts={false} />
  </>;
}
