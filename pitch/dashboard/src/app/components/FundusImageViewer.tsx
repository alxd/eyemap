import { useState } from 'react';
import { Upload, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface FundusImageViewerProps {
  onImageUpload?: (file: File) => void;
  onAnalyze?: () => void;
}

export function FundusImageViewer({ onImageUpload, onAnalyze }: FundusImageViewerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(
    '/fundus_tud.jpg'
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      onImageUpload?.(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Fundus Image
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden border-2 border-border">
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Fundus image"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No image uploaded</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <label className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" className="w-full" asChild>
              <span className="cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload New Image
              </span>
            </Button>
          </label>
          <Button onClick={onAnalyze} className="flex-1">
            Analyze Image
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Image captured: December 17, 2024</p>
          <p>• Device: Topcon TRC-50DX</p>
          <p>• Eye: Right (OD)</p>
        </div>
      </CardContent>
    </Card>
  );
}
