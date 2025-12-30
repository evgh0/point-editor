import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, LineLayer, PathLayer, PolygonLayer } from '@deck.gl/layers';
import { OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Info, MousePointer2, Move, RefreshCw, Download } from 'lucide-react';
import ContextMenu from './components/ContextMenu';
import OffsetSlider from './components/OffsetSlider';
import RangeSlider from './components/RangeSlider';
import './App.css';

// Types for our data
interface DataPoint {
  timestamp: any;
  displacement: number;
  force: number;
  originalData: any;
}

interface LineConstraint {
  id: string;
  startPointIndex: number;
  endPointIndex: number;
  intermediateIndices: number[];
}

const INITIAL_VIEW_STATE = {
  target: [50, 50, 0],
  zoom: 2
};

function App() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [bottomViewState, setBottomViewState] = useState<any>({
    target: [50, 50 * (1/16), 0],
    zoom: 1
  });
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [selectionBox, setSelectionBox] = useState<{ start: [number, number], end: [number, number] } | null>(null);
  const [mode, setMode] = useState<'view' | 'select'>('view');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [showOffsetSlider, setShowOffsetSlider] = useState(false);
  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [constraints, setConstraints] = useState<LineConstraint[]>([]);
  const [maskRanges, setMaskRanges] = useState<[number, number][]>([[0, 0]]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<any>(null);
  const bottomDeckRef = useRef<any>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 's') setMode('select');
      if (e.key.toLowerCase() === 'v') setMode('view');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const bounds = useMemo(() => {
    if (data.length === 0) return null;
    const minX = Math.min(...data.map(p => p.displacement));
    const maxX = Math.max(...data.map(p => p.displacement));
    const minY = Math.min(...data.map(p => p.force));
    const maxY = Math.max(...data.map(p => p.force));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [data]);

  const timeBounds = useMemo(() => {
    if (data.length === 0) return null;
    // Try to parse timestamp if it's not a number
    const times = data.map((p, i) => {
      if (typeof p.timestamp === 'number') return p.timestamp;
      return i; // Fallback to index if timestamp is not numeric
    });
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const minY = Math.min(...data.map(p => p.force));
    const maxY = Math.max(...data.map(p => p.force));
    return { minT, maxT, minY, maxY, width: maxT - minT, height: maxY - minY };
  }, [data]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingProgress(0);

    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        setLoadingProgress(progress);
      }
    };

    reader.onload = (e) => {
      // Use setTimeout to allow the UI to update the progress to 100% 
      // before starting the heavy synchronous XLSX parsing
      setTimeout(() => {
        try {
          const binaryStr = e.target?.result;
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const points: DataPoint[] = jsonData.slice(1).map((row) => ({
            timestamp: row[0],
            displacement: Number(row[1]) || 0,
            force: Number(row[2]) || 0,
            originalData: row
          })).filter(p => !isNaN(p.displacement) && !isNaN(p.force));

          setData(points);
          setMaskRanges([[0, points.length > 0 ? points.length - 1 : 0]]);

          if (points.length > 0) {
            setViewState({
              target: [50, 50, 0],
              zoom: -Math.log2(120 / 600)
            });
          }
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          alert("Error parsing Excel file. Please ensure it's a valid .xlsx or .xls file.");
        } finally {
          setIsLoading(false);
          setLoadingProgress(0);
        }
      }, 100);
    };

    reader.onerror = () => {
      alert("Error reading file.");
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  }, []);

  const handleExport = useCallback((exportSelectedOnly: boolean) => {
    if (data.length === 0) return;

    const pointsToExport = exportSelectedOnly 
      ? data.filter((_, i) => selectedIndices.has(i))
      : data;

    if (pointsToExport.length === 0) {
      alert("No points to export");
      return;
    }

    const exportData = pointsToExport.map(p => {
      const row = [p.timestamp, p.displacement, p.force];
      if (Array.isArray(p.originalData) && p.originalData.length > 3) {
        row.push(...p.originalData.slice(3));
      }
      return row;
    });

    const header = ['Timestamp', 'Displacement', 'Force'];
    if (exportData.length > 0 && exportData[0].length > 3) {
      for (let i = 3; i < exportData[0].length; i++) {
        header.push(`Column ${i + 1}`);
      }
    }
    
    const ws = XLSX.utils.aoa_to_sheet([header, ...exportData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    
    const filename = exportSelectedOnly ? "selected_points.xlsx" : "all_points.xlsx";
    XLSX.writeFile(wb, filename);
  }, [data, selectedIndices]);

  const gridLayers = useMemo(() => {
    if (!bounds) return [];
    
    const lines = [];
    const min = -500;
    const max = 500;
    const step = 10;
    
    for (let val = min; val <= max; val += step) {
      // Vertical lines
      lines.push({ 
        start: [val, min], 
        end: [val, max],
        isMain: val === 0 || val === 100
      });
      // Horizontal lines
      lines.push({ 
        start: [min, val], 
        end: [max, val],
        isMain: val === 0 || val === 100
      });
    }

    // Add a mark at the data's 0,0 coordinate
    const originX = ((0 - bounds.minX) / (bounds.width || 1)) * 100;
    const originY = ((0 - bounds.minY) / (bounds.height || 1)) * 100;
    const markSize = 2;
    
    lines.push({ start: [originX - markSize, originY], end: [originX + markSize, originY], isOrigin: true });
    lines.push({ start: [originX, originY - markSize], end: [originX, originY + markSize], isOrigin: true });

    return [
      new LineLayer({
        id: 'grid-layer',
        data: lines,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getSourcePosition: d => d.start,
        getTargetPosition: d => d.end,
        getColor: d => {
          if (d.isOrigin) return [255, 255, 255, 255];
          return d.isMain ? [100, 100, 100, 200] : [62, 62, 62, 100];
        },
        getWidth: d => {
          if (d.isOrigin) return 3;
          return d.isMain ? 2 : 1;
        }
      })
    ];
  }, [bounds]);

  const bottomLayers = useMemo(() => {
    if (!timeBounds || data.length === 0) return [];

    const aspect = 1 / 16;
    const pathData = data.map((d, i) => {
      const t = typeof d.timestamp === 'number' ? d.timestamp : i;
      const x = ((t - timeBounds.minT) / (timeBounds.width || 1)) * 100;
      // Scale Y to match the aspect ratio so it fills the view when X fills the view
      const y = ((d.force - timeBounds.minY) / (timeBounds.height || 1)) * (100 * aspect);
      return [x, y];
    });

    // Calculate mask rectangles
    const getX = (idx: number) => {
        if (idx < 0 || idx >= data.length) return 0;
        const d = data[idx];
        const t = typeof d.timestamp === 'number' ? d.timestamp : idx;
        return ((t - timeBounds.minT) / (timeBounds.width || 1)) * 100;
    };

    const yMax = 100 * aspect;
    const maskRects = maskRanges.map(range => {
        const xStart = getX(range[0]);
        const xEnd = getX(range[1]);
        return {
            polygon: [
                [xStart, 0],
                [xEnd, 0],
                [xEnd, yMax],
                [xStart, yMax]
            ]
        };
    });

    return [
      new PolygonLayer({
        id: 'mask-highlight',
        data: maskRects,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPolygon: d => d.polygon,
        getFillColor: [117, 117, 242, 40],
        stroked: true,
        getLineColor: [117, 117, 242, 200],
        getLineWidth: 1,
        lineWidthUnits: 'pixels'
      }),
      new PathLayer({
        id: 'time-force-path',
        data: [{ path: pathData }],
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        getPath: d => d.path,
        getColor: [117, 117, 242],
        getWidth: 2,
        widthUnits: 'pixels'
      })
    ];
  }, [data, timeBounds, maskRanges]);

  const handleSelection = useCallback((box: { start: [number, number], end: [number, number] }) => {
    if (!deckRef.current || !bounds || data.length === 0) return;
    
    const deck = deckRef.current.deck;
    const viewport = deck.getViewports()[0];

    const minX = Math.min(box.start[0], box.end[0]);
    const maxX = Math.max(box.start[0], box.end[0]);
    const minY = Math.min(box.start[1], box.end[1]);
    const maxY = Math.max(box.start[1], box.end[1]);

    const newSelected = new Set<number>();
    
    // Create a set of all constrained intermediate indices for fast lookup
    const constrainedIndices = new Set<number>();
    constraints.forEach(c => c.intermediateIndices.forEach(idx => constrainedIndices.add(idx)));

    data.forEach((d, i) => {
      const inRange = maskRanges.some(range => i >= range[0] && i <= range[1]);
      if (!inRange) return;
      if (constrainedIndices.has(i)) return; // Skip constrained points

      const x = ((d.displacement - bounds.minX) / (bounds.width || 1)) * 100;
      const y = ((d.force - bounds.minY) / (bounds.height || 1)) * 100;
      const screenPos = viewport.project([x, y]);
      
      if (screenPos[0] >= minX && screenPos[0] <= maxX && 
          screenPos[1] >= minY && screenPos[1] <= maxY) {
        newSelected.add(i);
      }
    });
    
    setSelectedIndices(newSelected);
  }, [data, bounds, constraints, maskRanges]);

  const onDragStart = useCallback((info: any) => {
    if (mode === 'select') {
      setSelectionBox({ start: [info.x, info.y], end: [info.x, info.y] });
      return true;
    }
    return false;
  }, [mode]);

  const onDrag = useCallback((info: any) => {
    if (selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, end: [info.x, info.y] } : null);
      return true;
    }
    return false;
  }, [selectionBox]);

  const onDragEnd = useCallback(() => {
    if (selectionBox) {
      handleSelection(selectionBox);
      setSelectionBox(null);
      return true;
    }
    return false;
  }, [selectionBox, handleSelection]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedIndices.size > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [selectedIndices]);

  const applyXOffset = useCallback(() => {
    setShowOffsetSlider(true);
    setXOffset(0);
    setYOffset(0);
  }, []);

  const handleOffsetChange = useCallback((newX: number, newY: number) => {
    setXOffset(newX);
    setYOffset(newY);
  }, []);

  const applyConstraints = useCallback((currentData: DataPoint[], currentConstraints: LineConstraint[]) => {
    let newData = [...currentData];
    currentConstraints.forEach(c => {
      const start = newData[c.startPointIndex];
      const end = newData[c.endPointIndex];
      const count = c.intermediateIndices.length;
      
      c.intermediateIndices.forEach((idx, i) => {
        const t = (i + 1) / (count + 1);
        newData[idx] = {
          ...newData[idx],
          displacement: start.displacement + (end.displacement - start.displacement) * t,
          force: start.force + (end.force - start.force) * t
        };
      });
    });
    return newData;
  }, []);

  const handleLineConstraint = useCallback(() => {
    if (selectedIndices.size < 3) {
      alert("Please select at least 3 points to create a line constraint.");
      return;
    }

    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const startPointIndex = sortedIndices[0];
    const endPointIndex = sortedIndices[sortedIndices.length - 1];
    const intermediateIndices = sortedIndices.slice(1, sortedIndices.length - 1);

    const newConstraint: LineConstraint = {
      id: Math.random().toString(36).substr(2, 9),
      startPointIndex,
      endPointIndex,
      intermediateIndices
    };

    const newConstraints = [...constraints, newConstraint];
    setConstraints(newConstraints);
    
    // Apply constraint immediately
    setData(prevData => applyConstraints(prevData, newConstraints));
    
    // Clear selection of intermediate points
    const newSelected = new Set(selectedIndices);
    intermediateIndices.forEach(idx => newSelected.delete(idx));
    setSelectedIndices(newSelected);
  }, [selectedIndices, constraints, applyConstraints]);

  const commitOffset = useCallback(() => {
    if (xOffset === 0 && yOffset === 0) {
      setShowOffsetSlider(false);
      return;
    }

    setData(prevData => {
      const newData = prevData.map((d, i) => {
        if (selectedIndices.has(i)) {
          return { 
            ...d, 
            displacement: d.displacement + xOffset,
            force: d.force + yOffset 
          };
        }
        return d;
      });
      return applyConstraints(newData, constraints);
    });
    setXOffset(0);
    setYOffset(0);
    setShowOffsetSlider(false);
  }, [xOffset, yOffset, selectedIndices, constraints, applyConstraints]);

  const xOffsetStep = useMemo(() => {
    if (!bounds) return 0.01;
    return bounds.width / 100;
  }, [bounds]);

  const yOffsetStep = useMemo(() => {
    if (!bounds) return 0.01;
    return bounds.height / 100;
  }, [bounds]);

  const layers = [
    ...gridLayers,
    new ScatterplotLayer({
      id: 'scatterplot-layer',
      data,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      pickable: true,
      opacity: 1,
      stroked: true,
      filled: false,
      radiusUnits: 'pixels',
      radiusMinPixels: 2,
      getPosition: (d: DataPoint, { index }) => {
        if (!bounds) return [0, 0];
        
        // Check if this index is an intermediate in any constraint
        const constraint = constraints.find(c => c.intermediateIndices.includes(index));
        
        if (constraint) {
          const startIdx = constraint.startPointIndex;
          const endIdx = constraint.endPointIndex;
          
          const getEffectivePos = (idx: number) => {
            const p = data[idx];
            let disp = p.displacement;
            let force = p.force;
            if (selectedIndices.has(idx)) {
              disp += xOffset;
              force += yOffset;
            }
            return { disp, force };
          };

          const startPos = getEffectivePos(startIdx);
          const endPos = getEffectivePos(endIdx);
          
          const stepIndex = constraint.intermediateIndices.indexOf(index);
          const t = (stepIndex + 1) / (constraint.intermediateIndices.length + 1);
          
          const interpDisp = startPos.disp + (endPos.disp - startPos.disp) * t;
          const interpForce = startPos.force + (endPos.force - startPos.force) * t;
          
          const x = ((interpDisp - bounds.minX) / (bounds.width || 1)) * 100;
          const y = ((interpForce - bounds.minY) / (bounds.height || 1)) * 100;
          return [x, y];
        }

        let disp = d.displacement;
        let force = d.force;
        if (selectedIndices.has(index)) {
          disp += xOffset;
          force += yOffset;
        }
        const x = ((disp - bounds.minX) / (bounds.width || 1)) * 100;
        const y = ((force - bounds.minY) / (bounds.height || 1)) * 100;
        return [x, y];
      },
      getRadius: (_, { index }) => {
        const inRange = maskRanges.some(range => index >= range[0] && index <= range[1]);
        if (!inRange) return 0;
        const baseRadius = selectedIndices.has(index) ? 6 : 3;
        // Shrink as zoom increases to allow for more precision
        return baseRadius * Math.pow(2.05, -(viewState.zoom - 2));
      },
      getLineColor: (_, { index }) => {
        const inRange = maskRanges.some(range => index >= range[0] && index <= range[1]);
        if (!inRange) return [0, 0, 0, 0];
        const constraint = constraints.find(c => 
          c.startPointIndex === index || 
          c.endPointIndex === index || 
          c.intermediateIndices.includes(index)
        );

        if (constraint) {
          if (constraint.startPointIndex === index) return [0, 255, 0, 255]; // Green
          if (constraint.endPointIndex === index) return [255, 0, 0, 255]; // Red
          return [0, 0, 255, 255]; // Blue
        }

        return selectedIndices.has(index) ? [255, 165, 0, 255] : [255, 165, 0, 255];
      },
      getLineWidth: (_, { index }) => {
        const baseWidth = selectedIndices.has(index) ? 2 : 1;
        return baseWidth * Math.pow(1.1, -(viewState.zoom - 2));
      },
      updateTriggers: {
        getPosition: [xOffset, yOffset, selectedIndices, constraints],
        getRadius: [selectedIndices, maskRanges, viewState.zoom],
        getLineColor: [selectedIndices, constraints, maskRanges],
        getLineWidth: [selectedIndices, viewState.zoom]
      },
      onHover: info => setHoverInfo(info),
      onClick: info => {
        if (info.index !== -1) {
          const inRange = maskRanges.some(range => info.index >= range[0] && info.index <= range[1]);
          if (!inRange) return;
          // Check if constrained intermediate
          const isConstrained = constraints.some(c => c.intermediateIndices.includes(info.index));
          if (isConstrained) return;

          setSelectedIndices(new Set([info.index]));
        } else {
          setSelectedIndices(new Set());
        }
      }
    })
  ];

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSpreadsheet size={20} color="#7575f2" />
          <h1>Displacement vs Force Plot</h1>
        </div>
        <div className="controls">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="file-input"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            className="btn btn-primary" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Upload size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            {isLoading ? 'Uploading...' : 'Upload XLSX'}
          </button>
        </div>
      </header>

      <main className="main-content" onContextMenu={handleContextMenu} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{ 
                width: '300px', 
                backgroundColor: '#1e1e1e', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid #3e3e3e',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: 'white' }}>
                  {loadingProgress < 100 ? 'Reading File...' : 'Processing Data...'}
                </h3>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  backgroundColor: '#333', 
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '10px'
                }}>
                  <div style={{ 
                    width: `${loadingProgress}%`, 
                    height: '100%', 
                    backgroundColor: '#7575f2',
                    transition: 'width 0.2s ease-out'
                  }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#888' }}>
                  {loadingProgress}%
                </p>
              </div>
            </div>
          )}
          <DeckGL
            ref={deckRef}
            views={new OrthographicView({ id: 'ortho' })}
          viewState={viewState}
          onViewStateChange={({ viewState }) => setViewState(viewState)}
          controller={{
            dragPan: mode === 'view',
            dragRotate: false,
            scrollZoom: true,
            doubleClickZoom: true,
            touchRotate: false
          }}
          layers={layers}
          getTooltip={({ object }: any) => object && `Time: ${object.timestamp}, Disp: ${object.displacement}, Force: ${object.force}`}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
        />

        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(selectionBox.start[0], selectionBox.end[0]),
              top: Math.min(selectionBox.start[1], selectionBox.end[1]),
              width: Math.abs(selectionBox.start[0] - selectionBox.end[0]),
              height: Math.abs(selectionBox.start[1] - selectionBox.end[1]),
              border: '1px solid #7575f2',
              backgroundColor: 'rgba(117, 117, 242, 0.2)',
              pointerEvents: 'none',
              zIndex: 10
            }}
          />
        )}

        <aside className="sidebar">
          <h2><Info size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Dataset Info</h2>
          <div className="data-info">
            <div className="mode-indicator" style={{ marginBottom: '15px', padding: '10px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Current Mode:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: mode === 'select' ? '#7575f2' : 'white' }}>
                {mode === 'select' ? <MousePointer2 size={16} /> : <Move size={16} />}
                {mode === 'select' ? 'Selection Mode (S)' : 'Viewing Mode (V)'}
              </div>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Press <strong>S</strong> for select, <strong>V</strong> for view
              </p>
            </div>
            <p>Points loaded: <span>{data.length}</span></p>
            <p>Points selected: <span>{selectedIndices.size}</span></p>
            <p>Zoom Level: <span>{viewState.zoom.toFixed(2)}</span></p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button 
                className="btn" 
                style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => {
                  const inverted = new Set<number>();
                  data.forEach((_, i) => {
                    if (!selectedIndices.has(i)) inverted.add(i);
                  });
                  setSelectedIndices(inverted);
                }}
                disabled={data.length === 0 || isLoading}
              >
                <RefreshCw size={14} /> Invert
              </button>
              {selectedIndices.size > 0 && (
                <button 
                  className="btn" 
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  onClick={() => setSelectedIndices(new Set())}
                  disabled={isLoading}
                >
                  Clear
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
               <button 
                  className="btn" 
                  style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => handleExport(false)}
                  disabled={data.length === 0 || isLoading}
                  title="Export all points to XLSX"
                >
                  <Download size={14} /> All
                </button>
                <button 
                  className="btn" 
                  style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => handleExport(true)}
                  disabled={selectedIndices.size === 0 || isLoading}
                  title="Export selected points to XLSX"
                >
                  <Download size={14} /> Selected
                </button>
            </div>

            {bounds && (
              <>
                <p>Disp Range: <span>{bounds.minX.toFixed(2)} to {bounds.maxX.toFixed(2)}</span></p>
                <p>Force Range: <span>{bounds.minY.toFixed(2)} to {bounds.maxY.toFixed(2)}</span></p>
              </>
            )}

            {constraints.length > 0 && (
              <div style={{ marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <h3 style={{ fontSize: '0.9rem', margin: '0 0 10px 0' }}>Active Constraints</h3>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {constraints.map(c => (
                    <div key={c.id} style={{ 
                      fontSize: '0.8rem', 
                      marginBottom: '8px', 
                      padding: '6px', 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <span style={{ color: '#00ff00' }}>●</span> {c.startPointIndex} → <span style={{ color: '#ff0000' }}>●</span> {c.endPointIndex}
                        <br/>
                        <span style={{ color: '#888', fontSize: '0.7rem' }}>({c.intermediateIndices.length} intermediate)</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newConstraints = constraints.filter(con => con.id !== c.id);
                          setConstraints(newConstraints);
                          // Re-apply remaining constraints to ensure data is consistent? 
                          // Actually, removing a constraint doesn't revert data, just stops future updates.
                        }}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#ff4444', 
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                        title="Remove Constraint"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ marginTop: '15px', fontStyle: 'italic' }}>
              Plot is normalized to a 1:1 aspect ratio. Both axes are scaled to fill the view.
            </p>
          </div>
        </aside>

        {hoverInfo?.object && (
          <div 
            className="tooltip" 
            style={{ left: hoverInfo.x, top: hoverInfo.y }}
          >
            <strong>Point Details</strong><br />
            Time: {hoverInfo.object.timestamp}<br />
            Disp: {hoverInfo.object.displacement}<br />
            Force: {hoverInfo.object.force}
          </div>
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onApplyXOffset={applyXOffset}
            onApplyLineConstraint={handleLineConstraint}
          />
        )}

        {showOffsetSlider && (
          <OffsetSlider
            xValue={xOffset}
            yValue={yOffset}
            onChange={handleOffsetChange}
            onClose={() => setShowOffsetSlider(false)}
            onApply={commitOffset}
            xStep={xOffsetStep}
            yStep={yOffsetStep}
          />
        )}
        </div>

        <div style={{ height: '1px', backgroundColor: '#3e3e3e', width: '100%' }} />

        <div style={{ width: '100%', aspectRatio: '16/1', position: 'relative', backgroundColor: '#1a1a1a' }}>
          <DeckGL
            ref={bottomDeckRef}
            views={new OrthographicView({ id: 'ortho-bottom' })}
            viewState={bottomViewState}
            controller={false}
            layers={bottomLayers}
            onResize={({ width }) => {
              if (width) {
                const zoom = Math.log2(width / 100);
                setBottomViewState((prev: any) => ({
                  ...prev,
                  zoom: zoom,
                  target: [50, 50 * (1/16), 0]
                }));
              }
            }}
          />
        </div>

        <div style={{ padding: '10px 20px', backgroundColor: '#1e1e1e', borderTop: '1px solid #3e3e3e' }}>
          {data.length > 0 && (
            <RangeSlider
              min={0}
              max={data.length - 1}
              ranges={maskRanges}
              onChange={setMaskRanges}
              style={{ position: 'relative', bottom: 'auto', left: 'auto', transform: 'none', width: '100%' }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
