import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Provider } from "@/lib/admin/types";

interface ProviderListCardProps {
  providers: Provider[];
  selectedProvider: Provider | null;
  onSelectProvider: (provider: Provider) => void;
}

export function ProviderListCard({
  providers,
  selectedProvider,
  onSelectProvider
}: ProviderListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {providers.map(provider => (
          <button
            key={provider.id}
            onClick={() => onSelectProvider(provider)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors",
              selectedProvider?.id === provider.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary"
            )}
          >
            <div>
              <p className="font-medium">{provider.name}</p>
              <p className="text-xs opacity-70">{provider.type}</p>
            </div>
            <Badge
              variant="secondary"
              className={
                provider.status === 'active'
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }
            >
              {provider.status}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
