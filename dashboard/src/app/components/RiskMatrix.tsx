import { CircleCheck, CircleX, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'very-high';

export interface PathologyResult {
  name: string;
  riskLevel: RiskLevel;
  confidence: number;
  details?: string;
}

interface RiskMatrixProps {
  results: PathologyResult[];
  timestamp?: string;
}

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-500';
    case 'moderate':
      return 'bg-yellow-500';
    case 'high':
      return 'bg-orange-500';
    case 'very-high':
      return 'bg-red-500';
  }
}

function getRiskTextColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-700';
    case 'moderate':
      return 'text-yellow-700';
    case 'high':
      return 'text-orange-700';
    case 'very-high':
      return 'text-red-700';
  }
}

function getRiskBgColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-50 border-green-200';
    case 'moderate':
      return 'bg-yellow-50 border-yellow-200';
    case 'high':
      return 'bg-orange-50 border-orange-200';
    case 'very-high':
      return 'bg-red-50 border-red-200';
  }
}

function getRiskIcon(level: RiskLevel) {
  switch (level) {
    case 'low':
      return <CircleCheck className="w-5 h-5" />;
    case 'moderate':
      return <AlertTriangle className="w-5 h-5" />;
    case 'high':
      return <AlertTriangle className="w-5 h-5" />;
    case 'very-high':
      return <CircleX className="w-5 h-5" />;
  }
}

function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'Low Risk';
    case 'moderate':
      return 'Moderate';
    case 'high':
      return 'High Risk';
    case 'very-high':
      return 'Very High';
  }
}

export function RiskMatrix({ results, timestamp }: RiskMatrixProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            AI Pathology Risk Assessment
          </CardTitle>
          {timestamp && (
            <span className="text-sm text-muted-foreground">
              Analyzed: {timestamp}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 transition-all ${getRiskBgColor(result.riskLevel)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={getRiskTextColor(result.riskLevel)}>
                    {getRiskIcon(result.riskLevel)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{result.name}</span>
                    </div>
                    {result.details && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {result.details}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`${getRiskTextColor(result.riskLevel)}`}>
                      {getRiskLabel(result.riskLevel)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.confidence}% confidence
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getRiskColor(result.riskLevel)}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4 text-sm">
            <span>Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>High Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Very High</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
