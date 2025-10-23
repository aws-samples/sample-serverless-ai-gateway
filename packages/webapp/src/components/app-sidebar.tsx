import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ModelSwitcher } from "@/components/model-switcher";
import { TokenUsageSidebar } from "@/components/token-usage-sidebar";
import { Model, ModelGroup } from "@/lib/models";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";

// Default sample data
const defaultData = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
};

export function AppSidebar({
    user,
    signOut,
    models,
    modelGroups,
    selectedModel,
    onModelChange,
    onClearChat,
    hasMessages,
    monthlyTokenUsage,
    monthlyTokenLimit,
    dailyTokenUsage,
    dailyTokenLimit,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    user?: {
        name?: string;
        email?: string;
        avatar?: string;
    };
    signOut?: () => void;
    models?: Model[];
    modelGroups?: ModelGroup[];
    selectedModel?: string;
    onModelChange?: (modelId: string) => void;
    onClearChat?: () => void;
    hasMessages?: boolean;
    monthlyTokenUsage?: number;
    monthlyTokenLimit?: number;
    dailyTokenUsage?: number;
    dailyTokenLimit?: number;
}) {
    // Use provided user data or fall back to sample data
    const userData = {
        name: user?.name || defaultData.user.name,
        email: user?.email || defaultData.user.email,
        avatar: user?.avatar || defaultData.user.avatar,
    };
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                {models && modelGroups && selectedModel && onModelChange ? (
                    <ModelSwitcher
                        models={models}
                        modelGroups={modelGroups}
                        selectedModel={selectedModel}
                        onModelChange={onModelChange}
                    />
                ) : null}
            </SidebarHeader>
            <SidebarContent>
                <NavMain onClearChat={onClearChat} disabled={!hasMessages} />
                <TokenUsageSidebar
                    monthlyTokenUsage={monthlyTokenUsage}
                    monthlyTokenLimit={monthlyTokenLimit}
                    dailyTokenUsage={dailyTokenUsage}
                    dailyTokenLimit={dailyTokenLimit}
                />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={userData} signOut={signOut} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
