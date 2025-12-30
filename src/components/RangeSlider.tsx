import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';

interface RangeSliderProps {
  min: number;
  max: number;
  ranges: [number, number][];
  onChange: (ranges: [number, number][]) => void;
  style?: React.CSSProperties;
}

const RangeSlider: React.FC<RangeSliderProps> = ({ min, max, ranges, onChange, style }) => {
  const [dragging, setDragging] = useState<{ index: number, handle: 'min' | 'max' } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const getPercentage = useCallback((val: number) => {
    return ((val - min) / (max - min)) * 100;
  }, [min, max]);

  const handleMouseDown = (index: number, handle: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ index, handle });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const percentage = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const newValue = Math.round(min + percentage * (max - min));
      
      const newRanges = [...ranges];
      const currentRange = newRanges[dragging.index];

      if (dragging.handle === 'min') {
        const newMin = Math.min(newValue, currentRange[1]);
        newRanges[dragging.index] = [newMin, currentRange[1]];
      } else {
        const newMax = Math.max(newValue, currentRange[0]);
        newRanges[dragging.index] = [currentRange[0], newMax];
      }
      
      onChange(newRanges);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, min, max, ranges, onChange]);

  const addRange = () => {
    // Add a new range in the middle 20% of the slider
    const rangeSize = (max - min) * 0.2;
    const start = min + (max - min) * 0.4;
    onChange([...ranges, [Math.round(start), Math.round(start + rangeSize)]]);
  };

  const removeRange = () => {
    if (ranges.length > 1) {
      onChange(ranges.slice(0, -1));
    }
  };

  return (
    <div 
      style={{ 
        position: 'absolute', 
        bottom: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        width: '80%', 
        height: '40px', 
        display: 'flex', 
        alignItems: 'center',
        zIndex: 100,
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        padding: '0 20px',
        borderRadius: '8px',
        border: '1px solid #3e3e3e',
        ...style
      }}
    >
      <div 
        ref={trackRef}
        style={{ 
          position: 'relative', 
          flex: 1, 
          height: '4px', 
          backgroundColor: '#3e3e3e', 
          borderRadius: '2px',
          marginRight: '15px'
        }}
      >
        {ranges.map((range, i) => {
            const minPos = getPercentage(range[0]);
            const maxPos = getPercentage(range[1]);
            const color = i % 2 === 0 ? '#7575f2' : '#f27575';
            
            return (
                <React.Fragment key={i}>
                    {/* Active Range Track */}
                    <div
                    style={{
                        position: 'absolute',
                        left: `${minPos}%`,
                        width: `${maxPos - minPos}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: '2px',
                        opacity: 0.8
                    }}
                    />

                    {/* Min Handle */}
                    <div
                    onMouseDown={handleMouseDown(i, 'min')}
                    style={{
                        position: 'absolute',
                        left: `${minPos}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        cursor: 'grab',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: 2,
                        border: `2px solid ${color}`
                    }}
                    />

                    {/* Max Handle */}
                    <div
                    onMouseDown={handleMouseDown(i, 'max')}
                    style={{
                        position: 'absolute',
                        left: `${maxPos}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        cursor: 'grab',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: 2,
                        border: `2px solid ${color}`
                    }}
                    />
                </React.Fragment>
            );
        })}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
            onClick={addRange}
            title="Add Range"
            style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
            }}
        >
            <Plus size={16} />
        </button>
        {ranges.length > 1 && (
            <button 
                onClick={removeRange}
                title="Remove Last Range"
                style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <Minus size={16} />
            </button>
        )}
      </div>
    </div>
  );
};

export default RangeSlider;
