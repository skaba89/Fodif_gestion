import styles from './InstitutionalFlow.module.css';

export type WorkflowStep = {
  label: string;
  description?: string;
};

function CompletedStepIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 8.25 6.5 11 12.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WorkflowStepper({
  steps,
  currentIndex,
  label = 'Progression du dossier',
  tone = 'default',
}: {
  steps: WorkflowStep[];
  currentIndex: number;
  label?: string;
  tone?: 'default' | 'inverse';
}) {
  const boundedCurrent = Math.max(0, Math.min(currentIndex, Math.max(steps.length - 1, 0)));

  return (
    <ol
      className={`${styles.stepper} ${tone === 'inverse' ? styles.stepperInverse : ''}`}
      aria-label={label}
      style={{ '--step-count': steps.length } as React.CSSProperties}
    >
      {steps.map((step, index) => {
        const done = index < boundedCurrent;
        const current = index === boundedCurrent;
        return (
          <li
            key={`${step.label}-${index}`}
            className={`${styles.step} ${done ? styles.stepDone : ''} ${current ? styles.stepCurrent : ''}`}
            aria-current={current ? 'step' : undefined}
          >
            <span className={styles.stepMarker} aria-hidden="true">
              {done ? <CompletedStepIcon /> : index + 1}
            </span>
            <span className={styles.stepText}>
              <strong>{step.label}</strong>
              {step.description ? <small>{step.description}</small> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
