import {
  HeaderSkeleton,
  FormSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Strategy creation wizard */}
      <div className="max-w-3xl">
        <FormSkeleton fields={10} />
      </div>
    </div>
  );
}
