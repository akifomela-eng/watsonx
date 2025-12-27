import { Layout } from "@/components/layout";
import { useSchedules, useCreateSchedule, useToggleSchedule } from "@/hooks/use-schedules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalendarClock, Plus, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Schedules() {
  const { data: schedules, isLoading } = useSchedules();
  const toggleSchedule = useToggleSchedule();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleToggle = (id: number, currentState: boolean) => {
    toggleSchedule.mutate({ id, isActive: !currentState }, {
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

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
          <h1 className="text-3xl font-light">Scan Scheduler</h1>
          <p className="text-muted-foreground">Automate periodic vulnerability assessments</p>
        </div>
        <CreateScheduleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schedules?.length === 0 ? (
          <div className="col-span-full p-12 text-center border border-dashed border-border text-muted-foreground">
            No active schedules. Create one to automate your scans.
          </div>
        ) : (
          schedules?.map((schedule) => (
            <div 
              key={schedule.id} 
              className={cn(
                "group relative bg-card border transition-all duration-200 p-6 space-y-4",
                schedule.isActive ? "border-primary/50 shadow-lg shadow-primary/5" : "border-border opacity-75"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-white mb-1 group-hover:text-primary transition-colors">
                    {schedule.name}
                  </h3>
                  <div className="flex items-center text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 w-fit rounded-sm">
                    <CalendarClock className="w-3 h-3 mr-2" />
                    {schedule.cronExpression}
                  </div>
                </div>
                <Switch 
                  checked={schedule.isActive}
                  onCheckedChange={() => handleToggle(schedule.id, schedule.isActive)}
                  disabled={toggleSchedule.isPending}
                />
              </div>

              <div className="space-y-2 pt-4 border-t border-border">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Target</span>
                  <div className="font-mono text-xs text-primary bg-primary/10 p-2 truncate">
                    {schedule.target}
                  </div>
                </div>
                
                <div className="flex justify-between items-end pt-2">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider block">Last Run</span>
                    <span className="text-sm text-gray-300">
                      {schedule.lastRun ? format(new Date(schedule.lastRun), "MMM d, HH:mm") : "Never"}
                    </span>
                  </div>
                  <div className={cn("h-2 w-2 rounded-full", schedule.isActive ? "bg-green-500 animate-pulse" : "bg-gray-700")} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}

function CreateScheduleDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createSchedule = useCreateSchedule();
  const [formData, setFormData] = useState({ name: "", cronExpression: "0 0 * * *", target: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSchedule.mutate(formData, {
      onSuccess: () => {
        toast({ title: "Schedule Created", description: "Automation job has been registered." });
        onOpenChange(false);
        setFormData({ name: "", cronExpression: "0 0 * * *", target: "" });
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
          <Plus className="w-4 h-4 mr-2" /> New Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border-border text-foreground rounded-none sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-light text-xl">Create Automation Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-400">Job Name</Label>
              <Input
                id="name"
                placeholder="Daily Contract Scan"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-[#0a0a0a] border-gray-700 focus:border-primary rounded-none h-12"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cron" className="text-gray-400">Cron Expression</Label>
              <Input
                id="cron"
                placeholder="0 0 * * *"
                value={formData.cronExpression}
                onChange={(e) => setFormData({...formData, cronExpression: e.target.value})}
                className="bg-[#0a0a0a] border-gray-700 focus:border-primary font-mono rounded-none h-12"
                required
              />
              <p className="text-xs text-muted-foreground">Example: 0 0 * * * (Every midnight)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target" className="text-gray-400">Target Address</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="target"
                  placeholder="0x..."
                  value={formData.target}
                  onChange={(e) => setFormData({...formData, target: e.target.value})}
                  className="pl-10 bg-[#0a0a0a] border-gray-700 focus:border-primary font-mono rounded-none h-12"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-none hover:bg-secondary">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createSchedule.isPending}
              className="bg-primary hover:bg-blue-600 rounded-none w-32"
            >
              {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Job"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
