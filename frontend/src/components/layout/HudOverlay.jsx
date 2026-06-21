import FeaturePanel from '../ui/FeaturePanel.jsx';

export default function HudOverlay({ hoveredFeature, tooltipPosition, selectedFeature, onCloseFeature }) {
  return (
    <>
      <div className="logo">
        STUDY<span>AI</span>
      </div>

      <div
        className="tooltip"
        style={{
          left: tooltipPosition.x + 14,
          top: tooltipPosition.y - 10,
          opacity: hoveredFeature ? 1 : 0,
        }}
      >
        {hoveredFeature?.label}
      </div>

      <div className="hint">
        Move mouse to explore &nbsp;·&nbsp; Click an orb to expand &nbsp;·&nbsp; Space to pause rotation
      </div>

      <FeaturePanel feature={selectedFeature} onClose={onCloseFeature} />
    </>
  );
}
