import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Drill } from '../../../shared/types';
import { api } from '../lib/api';
import { DrillViewer } from '../view/DrillViewer';

export default function SharedPage() {
  const { token } = useParams();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.shared(token!).then(setDrill).catch((e) => setError(e.message));
  }, [token]);
  if (error) return <div className="center-page"><p className="error">{error}</p></div>;
  if (!drill) return <div className="center-page">Loading…</div>;
  return <DrillViewer drill={drill} />;
}
