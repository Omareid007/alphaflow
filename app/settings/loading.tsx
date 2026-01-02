import {
  HeaderSkeleton,
  FormSkeleton,
  TabsSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Tabs (Profile, Security, Notifications, API Keys) */}
      <TabsSkeleton tabs={4} />

      {/* Settings form */}
      <div className="max-w-2xl">
        <FormSkeleton fields={6} />
      </div>
    </div>
  );
}
