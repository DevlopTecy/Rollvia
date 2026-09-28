import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightElement, required, id, className = '', ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
            {required && <span className="form-label-required">*</span>}
          </label>
        )}
        <div className="input-container">
          {leftIcon && <span className="input-left-icon">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`input-field ${leftIcon ? 'input-has-left-icon' : ''} ${error ? 'has-error' : ''} ${className}`}
            {...props}
          />
          {rightElement && (
            <div style={{ position: 'absolute', right: 10, display: 'flex', alignItems: 'center' }}>
              {rightElement}
            </div>
          )}
        </div>
        {error && <span className="form-error">{error}</span>}
        {!error && helperText && <span className="form-helper">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
