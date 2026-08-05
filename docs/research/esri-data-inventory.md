# Esri data inventory

## Confirmed references

The current CVC dashboard directory lists:

- [CVC Customer Geospatial Analysis](https://gis.chewy.local/portal/apps/dashboards/45dd5bd2153a4ddea487d212d0454f5a)
- [CVC Vet Competition Dashboard](https://gis.chewy.local/portal/apps/dashboards/6a78374147034580b18622eb9b0316a0)

Meeting notes report that the real-estate analytics team uses Esri for map overlays involving customer locations, competitor locations, drive-time maps, foot traffic, and census-style data. This requires validation with the dashboard owner.

## Access status

| Capability | Status |
| --- | --- |
| View internal dashboards | Not confirmed |
| Inspect layer names and metadata | Not confirmed |
| Export aggregate data | Not confirmed |
| Query ArcGIS REST services | Not confirmed |
| Create or edit maps | Not requested |
| Use customer-level coordinates | Not approved |

## Inventory fields to capture after access

For each layer, record:

- Layer name and business definition
- Owner and steward
- Geographic grain
- Refresh cadence and last refresh
- Source system
- Allowed uses
- PII classification
- Export and API permissions
- Coverage and known gaps
- Join keys or spatial reference system

## MVP rule

Use synthetic aggregates behind an adapter interface. Do not design around an assumed ArcGIS REST endpoint until the service, authentication method, allowed fields, and rate limits are confirmed.

Sources: SRC-002, SRC-003, SRC-010, SRC-011.
