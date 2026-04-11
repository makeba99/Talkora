import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AnimatedBackground } from "@/components/animated-background";
import { SocketProvider } from "@/lib/socket";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import Lobby from "@/pages/lobby";
import RoomPage from "@/pages/room";
import DmPage from "@/pages/dm";
import AdminPage from "@/pages/admin";

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const content = (
    <div className="h-screen flex flex-col overflow-hidden">
      <Switch>
        <Route path="/" component={Lobby} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/room/:id" component={RoomPage} />
        <Route path="/messages/:userId" component={DmPage} />
        <Route>
          <Lobby />
        </Route>
      </Switch>
    </div>
  );

  if (user) {
    return <SocketProvider userId={user.id}>{content}</SocketProvider>;
  }

  return content;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AnimatedBackground />
          <AppContent />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
