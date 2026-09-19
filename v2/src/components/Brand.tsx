interface BrandProps {
  compact?: boolean;
  inverse?: boolean;
  subtitle?: string;
}

export function Brand({ compact = false, inverse = false, subtitle = "Sales workspace" }: BrandProps) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""} ${inverse ? "inverse" : ""}`}>
      <span className="brand-logo-frame">
        <img src="./logo.png" alt="D2 Group" />
      </span>
      {!compact && (
        <span className="brand-wordmark">
          <strong>D2 CRM</strong>
          <small>{subtitle}</small>
        </span>
      )}
    </div>
  );
}
