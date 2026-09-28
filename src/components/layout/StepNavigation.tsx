import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useFlow } from '../../context';
import { STEPS } from '../../constants/steps';

export const StepNavigation: React.FC = () => {
  const { currentStep, completedSteps, goToStep } = useFlow();

  const maxCompleted = Math.max(0, ...completedSteps);

  return (
    <nav className="stepper-container" aria-label="Workflow progress navigation">
      <div className="stepper-nav">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.includes(step.id) && !isActive;
          const isClickable = step.id <= maxCompleted + 1;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                className={`step-item ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''} ${
                  isClickable ? 'is-clickable' : ''
                }`}
                onClick={() => {
                  if (isClickable) {
                    goToStep(step.id);
                  }
                }}
                title={`${step.id}. ${step.title}: ${step.subtitle}`}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="step-indicator">
                  {isCompleted ? (
                    <Check size={12} strokeWidth={2.8} />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span className="step-label">{step.shortLabel}</span>
              </button>

              {idx < STEPS.length - 1 && (
                <div className="step-divider" aria-hidden="true">
                  <ChevronRight size={12} strokeWidth={2} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
