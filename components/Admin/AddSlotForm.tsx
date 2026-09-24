"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSlot, createSlotsBulk } from "@/app/(admin)/actions/booking";
import { Plus, AlertCircle, CalendarPlus } from "lucide-react";

export default function AddSlotForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [single, setSingle] = useState({ startsAt: "", duration: 30 });
  const [bulk, setBulk] = useState({ date: "", startTime: "09:00", endTime: "17:00", interval: 30, duration: 30 });

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const result = await createSlot({ startsAt: single.startsAt, duration: Number(single.duration) });
    if (result.success) {
      setSingle({ startsAt: "", duration: 30 });
      router.refresh();
    } else {
      setError(result.error || "Failed to add slot.");
    }
    setIsSubmitting(false);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const result = await createSlotsBulk({
      date: bulk.date,
      startTime: bulk.startTime,
      endTime: bulk.endTime,
      interval: Number(bulk.interval),
      duration: Number(bulk.duration),
    });
    if (result.success) {
      setBulk({ ...bulk, date: "" });
      router.refresh();
    } else {
      setError(result.error || "Failed to generate slots.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">Add Available Times</h2>
        <div className="flex gap-1 bg-background rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "single" ? "bg-brand-orange-deep text-white" : "text-muted"}`}
          >
            Single Slot
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === "bulk" ? "bg-brand-orange-deep text-white" : "text-muted"}`}
          >
            Generate a Day
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 p-4 rounded-lg flex items-center gap-2 mb-4">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {mode === "single" ? (
        <form onSubmit={handleSingleSubmit} className="grid sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-muted mb-1">Date & Time</label>
            <input
              type="datetime-local"
              required
              value={single.startsAt}
              onChange={(e) => setSingle({ ...single, startsAt: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Duration (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              required
              value={single.duration}
              onChange={(e) => setSingle({ ...single, duration: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
            >
              <Plus size={18} />
              {isSubmitting ? "Adding..." : "Add Slot"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Date</label>
            <input
              type="date"
              required
              value={bulk.date}
              onChange={(e) => setBulk({ ...bulk, date: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Start Time</label>
            <input
              type="time"
              required
              value={bulk.startTime}
              onChange={(e) => setBulk({ ...bulk, startTime: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">End Time</label>
            <input
              type="time"
              required
              value={bulk.endTime}
              onChange={(e) => setBulk({ ...bulk, endTime: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Every (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              required
              value={bulk.interval}
              onChange={(e) => setBulk({ ...bulk, interval: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Duration (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              required
              value={bulk.duration}
              onChange={(e) => setBulk({ ...bulk, duration: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
            >
              <CalendarPlus size={18} />
              {isSubmitting ? "Generating..." : "Generate Slots"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
