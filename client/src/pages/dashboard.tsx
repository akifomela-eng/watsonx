import { Layout } from "@/components/layout";
import { StatCard } from "@/components/stat-card";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { Shield, Brain, Clock, Terminal, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <Layout>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-card border border-border"></div>)}
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive">
          Failed to load dashboard statistics.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-light mb-2">System Overview</h1>
        <p className="text-muted-foreground">Real-time metrics from Watsonx scanning engine</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Scans" 
          value={stats?.totalScans || 0} 
          icon={Shield} 
          color="primary"
          trend="All time analysis operations"
        />
        <StatCard 
          title="Critical Vulnerabilities" 
          value={stats?.criticalVulnerabilities || 0} 
          icon={Brain} 
          color="destructive"
          trend="Detected by Granite AI Model"
        />
        <StatCard 
          title="Active Schedules" 
          value={stats?.activeSchedules || 0} 
          icon={Clock} 
          color="accent"
          trend="Monitoring tasks running"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-light">Recent AI Decisions</h2>
            <Link href="/scans" className="text-sm text-primary hover:text-primary/80 flex items-center">
              View All Scans <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          <div className="bg-card border border-border divide-y divide-border">
            {stats?.recentDecisions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No recent activity recorded.
              </div>
            ) : (
              stats?.recentDecisions.map((decision) => (
                <div key={decision.id} className="p-4 hover:bg-secondary/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={decision.priority} type="decision" />
                      <span className="text-xs text-muted-foreground font-mono">
                        Model: {decision.modelUsed}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 text-gray-300">
                      {decision.reasoning}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(decision.createdAt!), "MMM d, HH:mm:ss")}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 min-w-[100px] justify-end">
                    <div className="text-right">
                      <div className="text-2xl font-light font-mono text-primary">
                        {decision.confidence}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Confidence
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Status / Mini Terminal */}
        <div className="space-y-6">
          <h2 className="text-xl font-light">Engine Status</h2>
          <div className="bg-[#0a0a0a] border border-border p-4 font-mono text-xs h-[300px] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-2">
              <Terminal className="h-3 w-3 text-green-500" />
              <span className="text-gray-400">root@watsonx-scanner:~</span>
            </div>
            <div className="space-y-2 text-gray-300 flex-1 overflow-y-auto">
              <div><span className="text-green-500">➜</span> System initialized</div>
              <div><span className="text-green-500">➜</span> Connecting to Granite Model... <span className="text-primary">OK</span></div>
              <div><span className="text-green-500">➜</span> Scheduler service active</div>
              <div><span className="text-green-500">➜</span> Monitoring blockchain events</div>
              <div className="opacity-50 mt-4 border-t border-dashed border-gray-800 pt-2">
                Waiting for incoming streams...
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-800 animate-pulse text-primary">
              _
            </div>
          </div>
          
          <div className="p-4 bg-primary/10 border border-primary/20">
            <h3 className="text-sm font-medium text-primary mb-2">Watsonx Integration</h3>
            <p className="text-xs text-muted-foreground">
              This system uses IBM Watsonx.ai for intelligent vulnerability assessment using the Granite foundation model.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
