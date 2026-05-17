type RefreshRequiredBannerProps = {
  onResolve(): void;
};

export function RefreshRequiredBanner({
  onResolve,
}: RefreshRequiredBannerProps) {
  return (
    <aside role="alert" aria-label="Sync conflict">
      <p>Your changes could not be synced. The server version has changed.</p>
      <button onClick={onResolve} type="button">
        Resolve conflict
      </button>
    </aside>
  );
}
