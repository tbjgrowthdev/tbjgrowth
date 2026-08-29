import React, { useMemo } from 'react';
import { calculateKeywordDensity, calculateReadabilityScore } from '@/lib/seo-utils';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface SEOScorePanelProps {
  content: string;
  title: string;
  description: string;
  focusKeyword: string;
}

function StatusIcon({ status }: { status: 'good' | 'warning' | 'error' }) {
  if (status === 'good') return <CheckCircle2 size={18} className="text-green-500" />;
  if (status === 'warning') return <AlertCircle size={18} className="text-yellow-500" />;
  return <XCircle size={18} className="text-red-500" />;
}

export default function SEOScorePanel({ content, title, description, focusKeyword }: SEOScorePanelProps) {
  const density = useMemo(() => calculateKeywordDensity(content, focusKeyword), [content, focusKeyword]);
  const readability = useMemo(() => calculateReadabilityScore(content), [content]);

  return (
    <div className="bg-background p-4 rounded-lg border border-border space-y-4">
      <h3 className="font-semibold text-foreground">SEO Analysis</h3>
      
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted">
            <StatusIcon status={title.length > 30 && title.length < 60 ? 'good' : 'warning'} />
            <span>Title Length ({title.length} chars)</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted">
            <StatusIcon status={description.length > 120 && description.length < 160 ? 'good' : 'warning'} />
            <span>Meta Description Length ({description.length} chars)</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted">
            <StatusIcon status={focusKeyword && density >= 0.5 && density <= 2.5 ? 'good' : (focusKeyword ? 'warning' : 'error')} />
            <span>Keyword Density</span>
          </div>
          <span className="font-medium">{density.toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted">
            <StatusIcon status={readability.score > 60 ? 'good' : 'warning'} />
            <span>Readability ({readability.label})</span>
          </div>
          <span className="font-medium">{readability.score}/100</span>
        </div>
      </div>
    </div>
  );
}
