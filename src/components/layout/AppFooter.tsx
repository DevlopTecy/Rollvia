import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useFlow } from '../../context';
import { STEPS } from '../../constants/steps';
import { Button } from '../ui/Button';

export const AppFooter: React.FC = () => {
  const { currentStep, canGoPrev, canGoNext, nextStep, prevStep, currentStepMeta } = useFlow();

  const nextStepMeta = STEPS.find((s) => s.id === currentStep + 1);

  return (
    <footer className="app-footer">
      <div className="footer-left">
        <Button
          variant="outline"
          size="md"
          icon={<ArrowLeft size={15} />}
          onClick={prevStep}
          disabled={!canGoPrev}
        >
          Previous
        </Button>
      </div>

      <div className="footer-center">
        <span>Step {currentStep} of {STEPS.length}:</span>
        <strong>{currentStepMeta.title}</strong>
      </div>

      <div className="footer-right">
        {currentStep < STEPS.length ? (
          <Button
            variant="primary"
            size="md"
            icon={<ArrowRight size={15} />}
            iconPosition="right"
            onClick={nextStep}
            disabled={!canGoNext}
          >
            Continue to {nextStepMeta?.shortLabel || 'Next'}
          </Button>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Session Complete</span>
        )}
      </div>
    </footer>
  );
};
