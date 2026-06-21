import { useCallback, useState } from 'react';
import HudOverlay from '../components/layout/HudOverlay.jsx';
import StudyScene from '../components/ui/StudyScene.jsx';

export default function LandingPage() {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const clearSelection = useCallback(() => setSelectedFeature(null), []);

  return (
    <main className="landing-page">
      <StudyScene
        onHoverFeature={setHoveredFeature}
        onSelectFeature={setSelectedFeature}
        onTooltipMove={setTooltipPosition}
        onClearSelection={clearSelection}
      />

      <HudOverlay
        hoveredFeature={hoveredFeature}
        tooltipPosition={tooltipPosition}
        selectedFeature={selectedFeature}
        onCloseFeature={clearSelection}
      />
    </main>
  );
}
