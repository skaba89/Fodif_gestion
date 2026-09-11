import styles from './InstitutionalFlow.module.css';

export type WorkflowStep = {
  label: string;
  description?: string;
};

export default function WorkflowStepper({
  steps,
  currentIndex,
  label = 'Progression du dossier',
}: {
  steps: WorkflowStep[];
  currentIndex: number;
  label?: string;
}) {
  const boundedCurrent = Math.max(0, Math.min(currentIndex, Math.max(steps.length - 1, 0)));

  return (
    <ol
      className={styles.stepper}
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
            <span className={styles.stepMarker} aria-hidden="true">{done ? '✓' : index + 1}</span>
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
