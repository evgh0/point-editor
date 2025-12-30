import React from 'react';
import { X } from 'lucide-react';

interface OffsetSliderProps {
  xValue: number;
  yValue: number;
  onChange: (x: number, y: number) => void;
  onClose: () => void;
  onApply: () => void;
  xStep: number;
  yStep: number;
}

const OffsetSlider: React.FC<OffsetSliderProps> = ({ 
  xValue, 
  yValue,
  onChange, 
  onClose, 
  onApply,
  xStep,
  yStep
}) => {
  const xMin = -xStep * 100;
  const xMax = xStep * 100;
  const yMin = -yStep * 100;
  const yMax = yStep * 100;

  return (
    <div
      style={{
        position: 'absolute',
        top: '70px',
        right: '20px',
        backgroundColor: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '16px',
        zIndex: 100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        width: '280px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>Offset Adjustment</span>
        <button 
          onClick={onClose}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#888', 
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>
      
      {/* X Offset */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa' }}>
          <span>X-Offset: {xValue.toFixed(4)}</span>
        </div>
        <input
          type="range"
          min={xMin}
          max={xMax}
          step={xStep}
          value={xValue}
          onChange={(e) => onChange(parseFloat(e.target.value), yValue)}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: '#7575f2'
          }}
        />
      </div>

      {/* Y Offset */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa' }}>
          <span>Y-Offset: {yValue.toFixed(4)}</span>
        </div>
        <input
          type="range"
          min={yMin}
          max={yMax}
          step={yStep}
          value={yValue}
          onChange={(e) => onChange(xValue, parseFloat(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: '#7575f2'
          }}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          className="btn" 
          style={{ flex: 1, fontSize: '12px', padding: '8px' }}
          onClick={() => onChange(0, 0)}
        >
          Reset
        </button>
        <button 
          className="btn btn-primary" 
          style={{ flex: 2, fontSize: '12px', padding: '8px' }}
          onClick={onApply}
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
};

export default OffsetSlider;
