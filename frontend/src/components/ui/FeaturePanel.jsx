import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function FeaturePanel({ feature, onClose }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  // Features that require at least one processed document before use
  const REQUIRES_DOCUMENT = ['chat', 'quiz', 'flashcards', 'planner'];

  const handleOpen = async (e) => {
    e.preventDefault();
    const featureId = feature?.id || 'upload';

    if (!REQUIRES_DOCUMENT.includes(featureId)) {
      
      navigate(`/${featureId}`);
      return;
    }

    setChecking(true);
    try {
      const { count, error } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ready');

      if (error) throw error;

      if (!count || count === 0) {
        alert('No PDF uploaded yet. Please upload a document first.');
       
        navigate('/upload');
        return;
      }

     
      navigate(`/${featureId}`);
    } catch (err) {
      alert('Could not verify your documents. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={`feature-panel ${feature ? 'open' : ''}`}>
      <button className="close-btn" onClick={onClose} aria-label="Close panel">
        ✕
      </button>

      <h2>{feature?.title || 'Feature'}</h2>

      <div className="stat-chips">
        {(feature?.chips || []).map((chip) => (
          <span className="chip" key={chip}>{chip}</span>
        ))}
      </div>

      <p>{feature?.desc || 'Description'}</p>

      <button
        onClick={handleOpen}
        disabled={checking}
        className="panel-btn inline-block"
      >
        {checking ? 'Checking...' : `Open ${feature?.title || 'Feature'}`}
      </button>
    </div>
  );
}