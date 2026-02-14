import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import OrderReview from "./pages/OrderReview";
import OrderFulfill from "./pages/OrderFulfill";
import ARInvoices from "./pages/ARInvoices";
import ARPayments from "./pages/ARPayments";
import ARApply from "./pages/ARApply";
import AuditLogs from "./pages/AuditLogs";
import CommissionStats from "./pages/CommissionStats";
import CommissionRules from "./pages/CommissionRules";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/orders/review"} component={OrderReview} />
      <Route path={"/orders/fulfill"} component={OrderFulfill} />
      <Route path={"/ar/invoices"} component={ARInvoices} />
      <Route path={"/ar/payments"} component={ARPayments} />
      <Route path={"/ar/apply"} component={ARApply} />
      <Route path={"/audit/logs"} component={AuditLogs} />
      <Route path={"/commission/stats"} component={CommissionStats} />
      <Route path={"/commission/rules"} component={CommissionRules} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
