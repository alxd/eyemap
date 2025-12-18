import { AlertCircle, CheckCircle2, ClipboardList, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { PathologyResult, RiskLevel } from './RiskMatrix';

interface RecommendationsPanelProps {
  results: PathologyResult[];
}

interface Recommendation {
  priority: 'urgent' | 'high' | 'normal';
  title: string;
  description: string;
  action: string;
}

function generateRecommendations(results: PathologyResult[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const veryHighRisk = results.filter(r => r.riskLevel === 'very-high');
  const highRisk = results.filter(r => r.riskLevel === 'high');
  const moderateRisk = results.filter(r => r.riskLevel === 'moderate');

  if (veryHighRisk.length > 0) {
    veryHighRisk.forEach(result => {
      recommendations.push({
        priority: 'urgent',
        title: `Immediate attention required for ${result.name}`,
        description: `Very high risk detected with ${result.confidence}% confidence.`,
        action: 'Refer to specialist immediately. Schedule comprehensive examination within 24-48 hours.',
      });
    });
  }

  if (highRisk.length > 0) {
    highRisk.forEach(result => {
      recommendations.push({
        priority: 'high',
        title: `Follow-up required for ${result.name}`,
        description: `High risk detected with ${result.confidence}% confidence.`,
        action: 'Schedule follow-up appointment within 1-2 weeks. Consider specialist referral.',
      });
    });
  }

  if (moderateRisk.length > 0) {
    recommendations.push({
      priority: 'normal',
      title: 'Monitor conditions with moderate risk',
      description: `${moderateRisk.map(r => r.name).join(', ')} showing moderate risk levels.`,
      action: 'Schedule routine follow-up in 3-6 months. Continue regular monitoring.',
    });
  }

  if (veryHighRisk.length === 0 && highRisk.length === 0 && moderateRisk.length === 0) {
    recommendations.push({
      priority: 'normal',
      title: 'All pathologies within normal range',
      description: 'No significant risk factors detected in current screening.',
      action: 'Continue annual routine screening. Maintain healthy lifestyle habits.',
    });
  }

  return recommendations;
}

function getPriorityStyles(priority: 'urgent' | 'high' | 'normal') {
  switch (priority) {
    case 'urgent':
      return {
        border: 'border-red-200',
        bg: 'bg-red-50',
        icon: <AlertCircle className="w-5 h-5 text-red-600" />,
        badge: 'bg-red-600 text-white',
      };
    case 'high':
      return {
        border: 'border-orange-200',
        bg: 'bg-orange-50',
        icon: <AlertCircle className="w-5 h-5 text-orange-600" />,
        badge: 'bg-orange-600 text-white',
      };
    case 'normal':
      return {
        border: 'border-blue-200',
        bg: 'bg-blue-50',
        icon: <CheckCircle2 className="w-5 h-5 text-blue-600" />,
        badge: 'bg-blue-600 text-white',
      };
  }
}

export function RecommendationsPanel({ results }: RecommendationsPanelProps) {
  const recommendations = generateRecommendations(results);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Clinical Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec, index) => {
          const styles = getPriorityStyles(rec.priority);
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${styles.border} ${styles.bg}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{styles.icon}</div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium">{rec.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${styles.badge}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                  <div className="flex items-start gap-2 pt-2">
                    <CalendarClock className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm">{rec.action}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important Note</AlertTitle>
          <AlertDescription>
            This AI-powered analysis is intended to assist clinical decision-making and should not
            replace professional medical judgment. Always confirm findings with comprehensive
            clinical examination and additional diagnostic tests as needed.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
