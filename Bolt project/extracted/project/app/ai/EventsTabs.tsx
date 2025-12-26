import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiEvent } from "@/lib/types";
import { EventCard } from "./EventCard";

interface EventsTabsProps {
  events: AiEvent[];
  signalEvents: AiEvent[];
  riskEvents: AiEvent[];
}

export function EventsTabs({ events, signalEvents, riskEvents }: EventsTabsProps) {
  return (
    <Tabs defaultValue="all">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="all" className="mt-4">
        <Card>
          <CardContent className="p-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="signals" className="mt-4">
        <Card>
          <CardContent className="p-4">
            {signalEvents.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No signal events</p>
            ) : (
              signalEvents.map(event => <EventCard key={event.id} event={event} />)
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="risk" className="mt-4">
        <Card>
          <CardContent className="p-4">
            {riskEvents.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No risk alerts</p>
            ) : (
              riskEvents.map(event => <EventCard key={event.id} event={event} />)
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
