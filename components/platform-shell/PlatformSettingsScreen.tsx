"use client";

type Integration = {
  name: string;
  description: string;
  status: "Active" | "Disconnected" | "Active (Anonymized)";
  access: boolean;
  icon: string;
};

const integrations: Integration[] = [
  {
    name: "Marketing CRM",
    description: "Syncs customer regional engagement metrics and campaign performance.",
    status: "Active",
    access: true,
    icon: "▦",
  },
  {
    name: "Real Estate MLS",
    description: "Provides live property valuation and zoning intelligence feeds.",
    status: "Disconnected",
    access: false,
    icon: "⌂",
  },
  {
    name: "Healthcare Records",
    description: "Aggregated regional health trend data. Strict privacy compliance enforced.",
    status: "Active (Anonymized)",
    access: true,
    icon: "▰",
  },
];

export function PlatformSettingsScreen() {
  return (
    <section className="platform-settings" aria-labelledby="platform-settings-title">
      <div className="platform-page-header">
        <h1 id="platform-settings-title">Platform Settings &amp; Integrations</h1>
        <p>Manage connected data sources and agent access permissions across regions.</p>
      </div>

      <div className="integration-grid">
        {integrations.map((integration) => (
          <article className="integration-card" key={integration.name}>
            <div className="integration-card-topline">
              <span className="integration-icon" aria-hidden="true">{integration.icon}</span>
              <span className={`integration-status ${integration.status === "Disconnected" ? "disconnected" : "active"}`}>
                <i aria-hidden="true" />
                {integration.status}
              </span>
            </div>
            <div className="integration-card-copy">
              <h2>{integration.name}</h2>
              <p>{integration.description}</p>
            </div>
            <div className="integration-card-footer">
              <span className={integration.status === "Disconnected" ? "muted" : ""}>Agent Access</span>
              <span className={`access-toggle ${integration.access ? "on" : "off"}`} aria-label={`${integration.name} agent access ${integration.access ? "enabled" : "disabled"}`}>
                <i aria-hidden="true" />
              </span>
            </div>
          </article>
        ))}
      </div>

      <p className="settings-boundary">
        Prototype configuration only. These cards do not establish a production connector or authorize access to restricted data.
      </p>
    </section>
  );
}
