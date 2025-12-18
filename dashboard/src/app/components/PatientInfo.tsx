import { User, Calendar, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface PatientInfoProps {
  name: string;
  id: string;
  dateOfBirth: string;
  age: number;
  lastVisit: string;
}

export function PatientInfo({ name, id, dateOfBirth, age, lastVisit }: PatientInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Patient Information
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Patient Name</p>
          <p>{name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Patient ID</p>
          <p>{id}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Date of Birth</p>
          <p>{dateOfBirth}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Age</p>
          <p>{age} years</p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Last Visit</p>
          <p>{lastVisit}</p>
        </div>
      </CardContent>
    </Card>
  );
}
