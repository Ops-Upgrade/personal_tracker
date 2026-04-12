import TaskManagerView from "@/components/taskmanager/TaskManagerView";

export const metadata = {
  title: "Task Manager — Ops Upgrade",
  description: "Manage encrypted tasks and notes.",
};

/**
 * Task Manager route shell.
 * Phase 1.4: route + page wiring + static 3-box layout mount.
 */
export default function TaskManagerPage() {
  return <TaskManagerView />;
}
