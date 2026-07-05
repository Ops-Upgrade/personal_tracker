import ExpenseView from "@/components/expense/ExpenseView";

export const metadata = {
  title: "Expenses — Ops Upgrade",
  description: "Track and manage your encrypted expenses.",
};

/**
 * Expense Tracker route shell.
 * F2.3: route + page wiring.
 */
export default function ExpensePage() {
  return <ExpenseView />;
}
