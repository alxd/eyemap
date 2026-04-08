import { useState } from 'react';
import { Activity } from 'lucide-react';
import { PatientInfo } from './components/PatientInfo';
import { FundusImageViewer } from './components/FundusImageViewer';
import { RiskMatrix, type PathologyResult } from './components/RiskMatrix';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { Button } from './components/ui/button';

// Mock patient data
const mockPatient = {
  name: 'Sarah Johnson',
  id: 'PT-2024-0847',
  dateOfBirth: '03/15/1968',
  age: 56,
  lastVisit: 'Nov 12, 2024',
};

// Mock analysis results
const mockResults: PathologyResult[] = [
  {
    name: 'Age-Related Macular Degeneration (AMD)',
    riskLevel: 'low',
    confidence: 92,
    details: 'No signs of drusen or pigmentary changes detected',
  },
  {
    name: 'Diabetic Retinopathy',
    riskLevel: 'moderate',
    confidence: 78,
    details: 'Mild microaneurysms detected in inferior temporal quadrant',
  },
  {
    name: 'Glaucoma',
    riskLevel: 'low',
    confidence: 88,
    details: 'Cup-to-disc ratio within normal limits (0.3)',
  },
  {
    name: 'Hypertensive Angiopathy',
    riskLevel: 'very-high',
    confidence: 94,
    details: 'Severe arteriovenous nicking and flame-shaped hemorrhages present',
  },
  {
    name: 'Hypertensive Angiosclerosis',
    riskLevel: 'high',
    confidence: 85,
    details: 'Copper wire arterioles observed with vessel wall thickening',
  },
  {
    name: 'Hypertensive Retinopathy',
    riskLevel: 'very-high',
    confidence: 91,
    details: 'Cotton-wool spots and retinal edema detected - Grade III findings',
  },
  {
    name: 'Hypertensive Neuroretinopathy',
    riskLevel: 'moderate',
    confidence: 76,
    details: 'Early optic disc swelling noted, requires monitoring',
  },
];

export default function App() {
  const [showResults, setShowResults] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setShowResults(false);
    
    // Simulate AI analysis
    setTimeout(() => {
      setAnalyzing(false);
      setShowResults(true);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mockup Notice */}
      <div style={{
        background: 'linear-gradient(135deg, #7877c6 0%, #ff4b91 50%, #23d5ab 100%)',
        color: 'white',
        padding: '12px 16px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '14px'
      }}>
        ⚠️ This is a mockup and work in progress - Not for clinical use
      </div>

      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, #7877c6 0%, #ff4b91 50%, #23d5ab 100%)'
              }}>
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{
                  background: 'linear-gradient(135deg, #7877c6 0%, #ff4b91 50%, #23d5ab 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  eyemap.ai
                </h1>
                <p className="text-sm text-muted-foreground">
                  Preventive Retinal Pathology Screening
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">View History</Button>
              <Button variant="outline">Export Report</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Patient Information */}
          <PatientInfo {...mockPatient} />

          {/* Image and Analysis Section */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Fundus Image Viewer */}
            <div className="lg:col-span-1">
              <FundusImageViewer onAnalyze={handleAnalyze} />
            </div>

            {/* Risk Matrix */}
            <div className="lg:col-span-2">
              {analyzing ? (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <div>
                      <p className="text-lg">Analyzing fundus image...</p>
                      <p className="text-sm text-muted-foreground">
                        AI models processing retinal features
                      </p>
                    </div>
                  </div>
                </div>
              ) : showResults ? (
                <RiskMatrix results={mockResults} timestamp="Dec 17, 2024 10:23 AM" />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-border rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Click "Analyze Image" to start AI screening</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations Panel */}
          {showResults && !analyzing && (
            <RecommendationsPanel results={mockResults} />
          )}
        </div>
      </main>
    </div>
  );
}
