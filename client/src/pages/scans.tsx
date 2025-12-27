import { Layout } from "@/components/layout";
import { useScans, useCreateScan, useScan } from "@/hooks/use-scans";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Loader2, Database, Brain } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function Scans() {
  const { data: scans, isLoading } = useScans();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light">Security Scans</h1>
          <p className="text-muted-foreground">Monitor and manage blockchain vulnerability analysis</p>
        </div>
        <CreateScanDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      {/* Scans List Table */}
      <div className="border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-normal tracking-wider">ID</th>
                <th className="px-6 py-4 font-normal tracking-wider">Target</th>
                <th className="px-6 py-4 font-normal tracking-wider">Type</th>
                <th className="px-6 py-4 font-normal tracking-wider">Status</th>
                <th className="px-6 py-4 font-normal tracking-wider">Created</th>
                <th className="px-6 py-4 font-normal tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scans?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No scans found. Start a new analysis.
                  </td>
                </tr>
              ) : (
                scans?.map((scan) => (
                  <tr key={scan.id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      #{scan.id.toString().padStart(4, '0')}
                    </td>
                    <td className="px-6 py-4 font-mono text-primary truncate max-w-[200px]">
                      {scan.target}
                    </td>
                    <td className="px-6 py-4">{scan.type}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(scan.createdAt!), "MMM d, HH:mm")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-primary hover:text-white hover:bg-primary/20"
                        onClick={() => setSelectedScanId(scan.id)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail View Drawer */}
      <ScanDetailsSheet 
        scanId={selectedScanId} 
        onClose={() => setSelectedScanId(null)} 
      />
    </Layout>
  );
}

function CreateScanDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createScan = useCreateScan();
  const [target, setTarget] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createScan.mutate({ target, type: "ecdsa_analysis" }, {
      onSuccess: () => {
        toast({ title: "Scan Initiated", description: "Target has been queued for analysis." });
        onOpenChange(false);
        setTarget("");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-blue-600 text-white rounded-none h-12 px-6 shadow-lg shadow-blue-900/20">
          <Plus className="w-4 h-4 mr-2" /> New Scan
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border-border text-foreground rounded-none sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-light text-xl">Initiate New Analysis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="target" className="text-gray-400">Target (Address or Transaction Hash)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                id="target"
                placeholder="0x..."
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="pl-10 bg-[#0a0a0a] border-gray-700 focus:border-primary font-mono rounded-none h-12"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Analysis type defaults to <span className="text-primary font-mono">ecdsa_analysis</span>
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-none hover:bg-secondary">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createScan.isPending}
              className="bg-primary hover:bg-blue-600 rounded-none w-32"
            >
              {createScan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Scan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScanDetailsSheet({ scanId, onClose }: { scanId: number | null, onClose: () => void }) {
  const { data: scan, isLoading } = useScan(scanId || 0);
  const isOpen = !!scanId;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-[#1a1a1a] border-l border-border text-foreground w-full sm:max-w-xl overflow-y-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : scan ? (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 border-b border-border bg-[#161616]">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={scan.status} />
                <span className="font-mono text-xs text-muted-foreground">#{scan.id}</span>
              </div>
              <SheetTitle className="font-light text-2xl truncate font-mono text-primary">
                {scan.target}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                Initiated on {format(new Date(scan.createdAt!), "PPP p")}
              </p>
            </SheetHeader>

            <div className="flex-1 p-6 space-y-8">
              {/* AI Decision Section */}
              <div className="space-y-4">
                <h3 className="flex items-center text-lg font-light text-white">
                  <Brain className="w-5 h-5 mr-2 text-accent" />
                  Watsonx Analysis
                </h3>
                
                {scan.decision ? (
                  <div className="bg-card border border-border p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm text-muted-foreground">Priority Level</span>
                      <StatusBadge status={scan.decision.priority} type="decision" />
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm text-muted-foreground">Model Confidence</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${scan.decision.confidence}%` }}
                          />
                        </div>
                        <span className="font-mono text-primary font-bold">{scan.decision.confidence}%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block mb-2">AI Reasoning</span>
                      <p className="text-sm leading-relaxed text-gray-300 bg-secondary/20 p-3 border border-border/50">
                        {scan.decision.reasoning}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-secondary/10 border border-border border-dashed text-center text-muted-foreground text-sm">
                    Analysis pending or not available yet.
                  </div>
                )}
              </div>

              {/* Raw Data Section */}
              <div className="space-y-4">
                <h3 className="flex items-center text-lg font-light text-white">
                  <Database className="w-5 h-5 mr-2 text-gray-400" />
                  Scanner Results
                </h3>
                
                {scan.result ? (
                  <div className="space-y-4">
                    {scan.result.findings && (
                      <div className="bg-yellow-900/10 border border-yellow-900/30 p-4">
                        <h4 className="text-yellow-500 text-sm font-bold mb-1">Key Findings</h4>
                        <p className="text-sm text-yellow-200/80">{scan.result.findings}</p>
                      </div>
                    )}
                    
                    <div className="bg-[#0a0a0a] border border-border p-4 font-mono text-xs overflow-x-auto max-h-[300px]">
                      <pre className="text-gray-400">
                        {JSON.stringify(scan.result.rawData, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-secondary/10 border border-border border-dashed text-center text-muted-foreground text-sm">
                    No raw data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
