import React from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onApplyXOffset: () => void;
  onApplyLineConstraint: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onApplyXOffset, onApplyLineConstraint }) => {
  React.useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className="context-menu"
      style={{
        top: y,
        left: x,
      }}
    >
      <div
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          onApplyXOffset();
          onClose();
        }}
      >
        Apply X-Offset
      </div>
      <div
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          onApplyLineConstraint();
          onClose();
        }}
      >
        Line Constraint
      </div>
    </div>
  );
};

export default ContextMenu;
