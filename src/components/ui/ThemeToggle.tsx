import React, { useId } from 'react';
import { useTheme } from '../../context';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', style }) => {
  const { theme, toggleTheme } = useTheme();
  const rawId = useId();
  // Safe sanitized ID for SVG mask reference
  const maskId = `theme-mask-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isLight = theme === 'light';

  return (
    <label
      className={`themeToggle st-sunMoonThemeToggleBtn ${className}`.trim()}
      style={style}
      title={isLight ? 'Switch to Dark mode' : 'Switch to Light mode'}
      aria-label="Toggle light and dark mode"
    >
      <input
        type="checkbox"
        className="themeToggleInput"
        checked={isLight}
        onChange={toggleTheme}
        aria-label="Theme toggle switch"
      />
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <circle cx="12" cy="4" r="9" fill="black" />
        </mask>
        <circle
          className="sunMoon"
          cx="12"
          cy="12"
          r="9"
          mask={`url(#${maskId})`}
        />
        <g className="sunRays" stroke="currentColor">
          <line className="sunRay sunRay1" x1="12" y1="1" x2="12" y2="3" />
          <line className="sunRay sunRay2" x1="21.53" y1="6.5" x2="19.79" y2="7.5" />
          <line className="sunRay sunRay3" x1="21.53" y1="17.5" x2="19.79" y2="16.5" />
          <line className="sunRay sunRay4" x1="12" y1="23" x2="12" y2="21" />
          <line className="sunRay sunRay5" x1="2.47" y1="17.5" x2="4.21" y2="16.5" />
          <line className="sunRay sunRay6" x1="2.47" y1="6.5" x2="4.21" y2="7.5" />
        </g>
      </svg>
    </label>
  );
};

export default ThemeToggle;
