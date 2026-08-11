import { SectorWorkspace } from "@/components/opportunity-inbox/SectorWorkspace";
import { SECTOR_WORKSPACES } from "@/lib/opportunity-inbox/sector-catalog";

export default function MarketEcosystemPage() {
  return <SectorWorkspace definition={SECTOR_WORKSPACES["market-ecosystem"]} />;
}
