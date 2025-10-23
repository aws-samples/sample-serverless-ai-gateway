import { TokenUsageDisplay } from "@/components/ui/token-usage-display";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";

interface TokenUsageSidebarProps {
    monthlyTokenUsage?: number;
    monthlyTokenLimit?: number;
    dailyTokenUsage?: number;
    dailyTokenLimit?: number;
}

export function TokenUsageSidebar({
    monthlyTokenUsage,
    monthlyTokenLimit,
    dailyTokenUsage,
    dailyTokenLimit,
}: TokenUsageSidebarProps) {
    // If no limits are set, don't display the component
    if (!monthlyTokenLimit && !dailyTokenLimit) {
        return null;
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Token Usage</SidebarGroupLabel>
            <div className="px-3 py-2">
                <TokenUsageDisplay
                    monthlyTokenUsage={monthlyTokenUsage}
                    monthlyTokenLimit={monthlyTokenLimit}
                    dailyTokenUsage={dailyTokenUsage}
                    dailyTokenLimit={dailyTokenLimit}
                />
            </div>
        </SidebarGroup>
    );
}
