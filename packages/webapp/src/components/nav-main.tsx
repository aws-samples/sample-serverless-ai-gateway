"use client";

import { Bot } from "lucide-react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
} from "@/components/ui/sidebar";

export function NavMain({
    onClearChat,
    disabled,
}: {
    onClearChat?: () => void;
    disabled?: boolean;
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                <Collapsible
                    asChild
                    defaultOpen={false}
                    className="group/collapsible"
                >
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                                tooltip="New Chat"
                                onClick={(e) => {
                                    if (onClearChat && !disabled) {
                                        e.preventDefault();
                                        onClearChat();
                                    }
                                }}
                                disabled={disabled}
                            >
                                <Bot />
                                <span>New Chat</span>
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                {/* No sub-items needed */}
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </SidebarMenuItem>
                </Collapsible>
            </SidebarMenu>
        </SidebarGroup>
    );
}
