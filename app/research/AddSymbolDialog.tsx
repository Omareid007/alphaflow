import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Symbol {
  symbol: string;
  name: string;
  price: number;
}

interface AddSymbolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableSymbols: Symbol[];
  onAddSymbol: (symbol: string) => void;
}

export function AddSymbolDialog({
  open,
  onOpenChange,
  availableSymbols,
  onAddSymbol,
}: AddSymbolDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Symbol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Symbol to Watchlist</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-auto">
          {availableSymbols.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              All available symbols are already in your watchlist
            </p>
          ) : (
            availableSymbols.map((item) => (
              <button
                key={item.symbol}
                onClick={() => onAddSymbol(item.symbol)}
                className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-secondary"
              >
                <div className="text-left">
                  <p className="font-medium">{item.symbol}</p>
                  <p className="text-sm text-muted-foreground">{item.name}</p>
                </div>
                <span className="text-muted-foreground">
                  ${item.price.toFixed(2)}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
