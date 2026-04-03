import WriterLayout from "./WriterLayout";
import WriterAnalyticsDashboard from "@/components/analytics/WriterAnalyticsDashboard";

const Analytics = () => {
  return (
    <WriterLayout forceDark hideThemeToggle>
      <WriterAnalyticsDashboard />
    </WriterLayout>
  );
};

export default Analytics;
