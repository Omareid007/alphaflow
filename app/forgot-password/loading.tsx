import { FormSkeleton } from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <FormSkeleton fields={2} />
      </div>
    </div>
  );
}
