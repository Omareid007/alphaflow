import {
  HeaderSkeleton,
  FormSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Strategy configuration form */}
      <div className="max-w-3xl">
        <FormSkeleton fields={8} />
      </div>
    </div>
  );
}
