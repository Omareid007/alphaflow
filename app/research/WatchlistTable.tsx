import { WatchlistItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface WatchlistTableProps {
  items: WatchlistItem[];
  onRemoveSymbol: (symbol: string) => void;
}

export function WatchlistTable({ items, onRemoveSymbol }: WatchlistTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Eligible</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.symbol}>
            <TableCell className="font-semibold">{item.symbol}</TableCell>
            <TableCell className="text-muted-foreground">{item.name}</TableCell>
            <TableCell className="text-right">
              ${item.price.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {item.change >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={
                    item.change >= 0 ? "text-success" : "text-destructive"
                  }
                >
                  {item.change >= 0 ? "+" : ""}${item.change.toFixed(2)} (
                  {item.changePercent.toFixed(2)}%)
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              {item.eligible ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveSymbol(item.symbol)}
              >
                <X className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
