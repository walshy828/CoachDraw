import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Drill } from '../../../shared/types';
import { api } from '../lib/api';
import { DrillViewer } from '../view/DrillViewer';

/** The owner's drill in the full-screen presenter. */
export default function ViewPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setDrill(null);
    api.getDrill(Number(id)).then(setDrill).catch((e) => setError(e.message));
  }, [id]);
  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
        <Link to="/">Back to your drills</Link>
      </div>
    );
  }
  if (!drill) return <div className="center-page">Loading…</div>;
  return <DrillViewer drill={drill} onExit={() => nav('/')} onEdit={() => nav(`/drill/${id}`)} />;
}
