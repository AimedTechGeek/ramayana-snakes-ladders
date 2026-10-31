import { t } from '../../i18n/i18n';

interface LoadingScreenProps {
  /** 0..1 of the asset bytes loaded; the star on the divider travels with it. */
  progress: number;
  /** The stage caption; defaults to `ui.loading`. */
  stage?: string;
}

/** The first screen: the title word, a divider whose star travels with the load progress, and a caption. */
export function LoadingScreen({ progress, stage }: LoadingScreenProps) {
  const done = Math.max(0, Math.min(1, progress));
  return (
    <main className="screen loading" data-testid="loading" role="status">
      <h1 className="display">{t('ui.brand')}</h1>
      <div className="progress-divider" aria-hidden="true">
        <span className="divider-line" />
        <svg
          className="sparkle"
          style={{ left: `${done * 100}%` }}
          width="12"
          height="12"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M12 1.5c.7 5.8 4.7 9.8 10.5 10.5-5.8.7-9.8 4.7-10.5 10.5-.7-5.8-4.7-9.8-10.5-10.5C7.3 11.3 11.3 7.3 12 1.5z"
          />
        </svg>
      </div>
      <p className="caption">{stage ?? t('ui.loading')}</p>
    </main>
  );
}
