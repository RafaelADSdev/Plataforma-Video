export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
      {action ? <div className="cluster" style={{ justifyContent: "center", marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}
